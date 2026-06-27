import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

// 5 ticket submissions per IP per 10 minutes (stricter than chat — email side-effect)
const RATE_LIMIT = 5
const WINDOW_MS = 10 * 60_000

interface RateEntry { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateEntry>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
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

    if (isRateLimited(ip)) {
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
      .select("id, name, config")
      .eq("publishable_key", key)
      .single()

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Invalid key" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const typedProject = project as unknown as ProjectRow & { name: string }
    const config = typedProject.config as unknown as ProjectConfig

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
        summary,
        reason: reason || null,
        conversation: conversation ? JSON.stringify(conversation) : null,
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

    // Optional email notification via Resend (no package needed — plain HTTP)
    const notificationEmail = config.notificationEmail
    if (notificationEmail && process.env.RESEND_API_KEY) {
      const conversationText = (conversation ?? [])
        .map(m => `${m.role === "user" ? "User" : "Bot"}: ${m.content}`)
        .join("\n")

      const emailBody =
        `New support ticket ${ref} from ${typedProject.name}\n\n` +
        `Name: ${name || "Anonymous"}\n` +
        `Email: ${email || "Not provided"}\n` +
        `Issue: ${summary}\n\n` +
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
          subject: `[${ref}] New support ticket — ${summary.slice(0, 60)}`,
          text: emailBody,
        }),
      }).catch(() => { /* non-fatal */ })
    }

    return new Response(JSON.stringify({ ref }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error"
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
}
