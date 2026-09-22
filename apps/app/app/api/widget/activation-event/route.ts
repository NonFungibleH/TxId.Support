import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import type { ProjectConfig } from "@/lib/types/config"
import { activationOn } from "@/lib/types/config"
import { originAllowed } from "@/lib/origin-guard"
import { recordEvent, type ActivationEvent } from "@/lib/activation/store"

/**
 * POST /api/widget/activation-event  { key, address, event }
 *
 * The readiness check's own funnel: was the prompt shown, opened, dismissed.
 * Each is stamped once per wallet. Always answers 204, including for a refused
 * or malformed call, because nothing the widget does depends on the answer and
 * a caller probing keys learns nothing from it.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const EVENTS: ActivationEvent[] = ["prompted", "opened", "dismissed"]

export const dynamic = "force-dynamic"

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function done() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  const { allowed } = await rateLimit(`activation-event:${clientIp(request)}`, 30, 60_000)
  if (!allowed) return done()

  let body: { key?: unknown; address?: unknown; event?: unknown }
  try { body = await request.json() } catch { return done() }
  const key = typeof body.key === "string" ? body.key : ""
  const address = typeof body.address === "string" ? body.address : ""
  const event = body.event as ActivationEvent
  if (!key.startsWith("pk_") || !/^0x[0-9a-fA-F]{40}$/.test(address) || !EVENTS.includes(event)) return done()

  const supabase = createServiceClient()
  const { data: project } = await supabase
    .from("projects")
    .select("id, config")
    .eq("publishable_key", key)
    .maybeSingle()
  if (!project) return done()
  const typed = project as unknown as { id: string; config: ProjectConfig }
  const config = typed.config ?? ({} as ProjectConfig)
  const publicSurface = config.publicDemo === true || key === process.env.DEMO_WIDGET_KEY
  if (!originAllowed(request, config.allowedDomains, { publicSurface })) return done()
  if (!activationOn(config)) return done()

  await recordEvent(typed.id, address, event)
  return done()
}
