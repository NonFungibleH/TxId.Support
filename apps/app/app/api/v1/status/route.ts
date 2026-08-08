import { waitUntil } from "@vercel/functions"
import { createServiceClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import type { ProjectConfig, IncidentConfig, IncidentLevel } from "@/lib/types/config"
import { activeStatusNotice } from "@/lib/types/config"

/**
 * POST /api/v1/status   Authorization: Bearer sk_…
 *
 * Raise or clear the status notice without opening the dashboard.
 *
 * WHY THIS EXISTS AND IS NOT OPTIONAL: at 3am the team is in their own
 * incident channel or their runbook, not logging into a settings page. A
 * control that requires a browser session is a control that gets used an hour
 * late. This is the difference between a feature that exists and one that is
 * actually reached for.
 *
 * Body: { level, message, topics?, expiresInHours? } or { clear: true }
 */

const LEVELS: IncidentLevel[] = ["notice", "restricted", "announcement_only"]

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const auth = request.headers.get("authorization") ?? ""
  const key = auth.startsWith("Bearer ") ? auth.slice(7).trim() : ""
  if (!key.startsWith("sk_")) {
    return json({ error: "Send your secret key as a Bearer token." }, 401)
  }

  const supabase = createServiceClient()
  const { data: project } = await supabase
    .from("projects")
    .select("id, config")
    .eq("secret_key", key)
    .maybeSingle()
  if (!project) return json({ error: "Unknown key." }, 401)

  const typed = project as unknown as { id: string; config: ProjectConfig }
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  if (body.clear === true) {
    await supabase
      .from("projects")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ config: { ...typed.config, incident: null } as any })
      .eq("id", typed.id)
    waitUntil(recordAudit({ action: "status_notice.cleared", target: "api", projectId: typed.id }))
    return json({ ok: true, active: null })
  }

  const level = String(body.level ?? "restricted") as IncidentLevel
  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (!LEVELS.includes(level)) return json({ error: `level must be one of ${LEVELS.join(", ")}` }, 400)
  if (!message) return json({ error: "message is required." }, 400)

  const hours = typeof body.expiresInHours === "number" ? body.expiresInHours : 4
  const incident: IncidentConfig = {
    level,
    message,
    ...(Array.isArray(body.topics)
      ? { topics: body.topics.filter((t): t is string => typeof t === "string").slice(0, 8) }
      : {}),
    raisedAt: new Date().toISOString(),
    raisedBy: "api",
    expiresAt: hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
  }

  await supabase
    .from("projects")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ config: { ...typed.config, incident } as any })
    .eq("id", typed.id)

  waitUntil(recordAudit({
    action: "status_notice.raised",
    target: level,
    projectId: typed.id,
    metadata: { message, via: "api", expiresAt: incident.expiresAt },
  }))

  return json({ ok: true, active: activeStatusNotice({ incident }) })
}
