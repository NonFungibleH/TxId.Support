import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { log } from "@/lib/logger"
import { originAllowed, originRefused } from "@/lib/origin-guard"
import type { ProjectConfig } from "@/lib/types/config"

/** Open by design, same as every other public surface. */
function isPublicSurface(key: string, config: { publicDemo?: boolean } | null | undefined): boolean {
  const a = process.env.DEMO_WIDGET_KEY
  const b = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY
  return (!!a && key === a) || (!!b && key === b) || config?.publicDemo === true
}

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
    const ip = clientIp(request)

    // Generous cap - feedback is cheap, but stop a loop from hammering it.
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
      pageUrl?: string
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
      .select("id, config")
      .eq("publishable_key", key)
      .single()
    if (!project) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // THIS is the thumbs route the widget actually calls, and it was the one
    // without an origin guard. A near-identical /api/widget/feedback route had
    // the guard and no callers, so the protection was sitting on the dead copy
    // while the live one took writes from anywhere. Thumbs feed the gaps view
    // and the "marked unhelpful" ticket signal, which is a quality signal a
    // team acts on: poisoning it is cheap and invisible. The dead route is gone.
    const config = (project as unknown as { config?: ProjectConfig }).config
    const hostPage = typeof body.pageUrl === "string" ? body.pageUrl : undefined
    if (!originAllowed(request, config?.allowedDomains, {
      publicSurface: isPublicSurface(key, config),
      ...(hostPage ? { hostPage } : {}),
    })) {
      return originRefused(CORS_HEADERS)
    }

    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("project_id", project.id)
      .eq("session_id", sessionId)
      .maybeSingle()
    if (!conv) {
      // Nothing persisted yet - nothing to rate. Treat as a no-op success.
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
