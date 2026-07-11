import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"
import { log } from "@/lib/logger"

// Cross-origin: the widget runs on the customer's site.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * Records a 👍/👎 (or clears it) on a single assistant answer.
 *
 * The widget knows an assistant message only by its rendered text (DB message
 * ids never reach the client), so we match on the conversation + exact content
 * of the most recent matching assistant row. Assistant answers are long and
 * near-unique, so this is reliable; a no-match is a silent no-op (e.g. a
 * client-only confirmation line that was never persisted).
 */
export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    // Generous cap — feedback is cheap, but stop a loop from hammering it.
    const { allowed } = await rateLimit(`feedback:${ip}`, 60, 60_000)
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many requests." }), {
        status: 429,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Retry-After": "60" },
      })
    }

    const body = (await request.json()) as {
      key?: string
      sessionId?: string
      content?: string
      rating?: number
    }
    const { key, sessionId, content } = body
    const rating = body.rating

    if (!key || !sessionId || typeof content !== "string" || ![1, -1, 0].includes(rating as number)) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const supabase = createServiceClient()

    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("publishable_key", key)
      .single()
    if (!project) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("project_id", project.id)
      .eq("session_id", sessionId)
      .maybeSingle()
    if (!conv) {
      // Nothing persisted yet — nothing to rate. Treat as a no-op success.
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Most recent assistant message with this exact text.
    const { data: msg } = await supabase
      .from("messages")
      .select("id")
      .eq("conversation_id", conv.id)
      .eq("role", "assistant")
      .eq("content", content)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (msg) {
      await supabase.from("messages").update({ feedback: rating as number }).eq("id", msg.id)
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  } catch (err) {
    log.error("Feedback error", err, { event: "feedback.error" })
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
}
