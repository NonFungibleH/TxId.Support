import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { originAllowed, originRefused } from "@/lib/origin-guard"

// Records the end-user's one-time Actions acknowledgement (the "I understand"
// modal in the widget). Audit-only: kind='ack', action_id NULL. The widget
// also stores the ack in localStorage; this row is the server-side record.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    const { allowed } = await rateLimit(`actions-ack:${ip}`, 10, 60_000)
    if (!allowed) return new Response(JSON.stringify({ error: "Too many requests" }), { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })

    const { key, sessionId } = (await request.json()) as { key?: string; sessionId?: string }
    if (!key || !sessionId) {
      return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
    }

    const supabase = createServiceClient()
    const { data: project } = await supabase.from("projects").select("id, config").eq("publishable_key", key).single()
    if (!project) {
      return new Response(JSON.stringify({ error: "Invalid key" }), { status: 401, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
    }
    // Same origin guard as every other widget endpoint.
    const ackConfig = (project as { config?: { allowedDomains?: string[] } }).config
    if (!originAllowed(request, ackConfig?.allowedDomains)) return originRefused(CORS_HEADERS)

    await supabase.from("action_events").insert({
      project_id: (project as { id: string }).id,
      session_id: sessionId,
      kind: "ack",
      status: "acknowledged",
      country: request.headers.get("x-vercel-ip-country"),
    } as never)

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
  } catch {
    return new Response(JSON.stringify({ error: "Internal error" }), { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
  }
}
