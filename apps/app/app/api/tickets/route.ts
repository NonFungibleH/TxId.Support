import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function makeRef(): string {
  // TKT- + 6 uppercase alphanumeric chars from current timestamp + random
  return "TKT-" + Math.random().toString(36).slice(2, 8).toUpperCase()
}

export async function POST(request: Request) {
  try {
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
    const ref = makeRef()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: insertError } = await (supabase as any).from("tickets").insert({
      project_id: typedProject.id,
      ref,
      user_name: name || null,
      user_email: email || null,
      summary,
      reason: reason || null,
      conversation: conversation ? JSON.stringify(conversation) : null,
      status: "open",
    })

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
