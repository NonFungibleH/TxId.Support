import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"
import { rateLimit } from "@/lib/rate-limit"
import { TICKET_LIMITS } from "@/lib/limits"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

function webhookSignature(payload: string): string {
  const secret = process.env.WEBHOOK_SECRET ?? ""
  if (!secret) return ""
  return "sha256=" + crypto.createHmac("sha256", secret).update(payload).digest("hex")
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function makeRef(): string {
  return "TKT-" + Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    // Stricter than chat (creating a ticket emails the team + fires a webhook).
    // Distributed via Upstash when configured; see lib/rate-limit.ts.
    const { allowed } = await rateLimit(`ticket:${ip}`, TICKET_LIMITS.ratePerWindow, TICKET_LIMITS.windowMs)
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many requests. Please try again later." }), {
        status: 429,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Retry-After": "600" },
      })
    }

    const body = (await request.json()) as {
      key: string
      name?: string
      email?: string
      summary: string
      reason?: string
      conversation?: Array<{ role: string; content: string }>
    }

    const { key, name, email, summary, reason, conversation } = body

    if (!key || !summary) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const supabase = createServiceClient()

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, config, is_active")
      .eq("publishable_key", key)
      .single()

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Invalid key" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const typedProject = project as unknown as ProjectRow & { name: string; is_active: boolean }
    const config = typedProject.config as unknown as ProjectConfig

    if (!typedProject.is_active) {
      return new Response(JSON.stringify({ error: "Project inactive" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Truncate inputs to prevent unbounded storage / email abuse
    const safeSummary = summary.slice(0, TICKET_LIMITS.maxSummaryChars)
    const safeConversation = (conversation ?? [])
      .slice(0, TICKET_LIMITS.maxConversationMsgs)
      .map(m => ({ ...m, content: m.content.slice(0, TICKET_LIMITS.maxMessageChars) }))

    // Retry up to 3 times on ref collision (unique constraint added in migration 20260627000002)
    let ref = ""
    let insertError = null
    for (let attempt = 0; attempt < 3; attempt++) {
      ref = makeRef()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (supabase as any).from("tickets").insert({
        project_id: typedProject.id,
        ref,
        user_name: name || null,
        user_email: email || null,
        summary: safeSummary,
        reason: reason || null,
        conversation: safeConversation.length ? JSON.stringify(safeConversation) : null,
        status: "open",
      })
      insertError = result.error
      if (!insertError) break
      if (insertError.code !== "23505") break // only retry on unique violation
    }

    if (insertError) {
      console.error("[tickets] insert error:", insertError)
      return new Response(JSON.stringify({ error: "Failed to create ticket" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Optional webhook notification — fires async, logs delivery result
    const webhookUrl = config.webhookUrl
    if (webhookUrl) {
      const webhookPayload = JSON.stringify({
        ref,
        project: typedProject.name,
        summary: safeSummary,
        reason: reason || null,
        user: { name: name || null, email: email || null },
        conversation: safeConversation,
      })
      const sig = webhookSignature(webhookPayload)
      void (async () => {
        const start = Date.now()
        try {
          const res = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(sig ? { "X-TxID-Signature": sig } : {}),
            },
            body: webhookPayload,
            signal: AbortSignal.timeout(5000),
          })
          const duration = Date.now() - start
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("webhook_logs").insert({
            project_id: typedProject.id,
            ticket_ref: ref,
            webhook_url: webhookUrl,
            status_code: res.status,
            success: res.ok,
            duration_ms: duration,
          })
        } catch (err) {
          const duration = Date.now() - start
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from("webhook_logs").insert({
            project_id: typedProject.id,
            ticket_ref: ref,
            webhook_url: webhookUrl,
            status_code: null,
            success: false,
            error_message: err instanceof Error ? err.message : "Unknown error",
            duration_ms: duration,
          }).catch(() => { /* non-fatal */ })
        }
      })()
    }

    // Optional email notification via Resend (no package needed — plain HTTP)
    const notificationEmail = config.notificationEmail
    if (notificationEmail && process.env.RESEND_API_KEY) {
      const conversationText = safeConversation
        .map(m => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`)
        .join("\n")

      const emailBody =
        `New support ticket ${ref} from ${typedProject.name}\n\n` +
        `Name: ${name || "Anonymous"}\n` +
        `Email: ${email || "Not provided"}\n` +
        `Issue: ${safeSummary}\n\n` +
        (conversationText ? `--- Conversation ---\n${conversationText}` : "")

      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "TxID Support <noreply@txid.support>",
          to: [notificationEmail],
          subject: `[${ref}] New support ticket: ${safeSummary.slice(0, 60)}`,
          text: emailBody,
        }),
      }).catch(() => { /* non-fatal */ })
    }

    return new Response(JSON.stringify({ ref }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    console.error("[tickets/POST]", err)
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
}
