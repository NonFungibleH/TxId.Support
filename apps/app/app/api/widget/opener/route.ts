import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import type { ProjectConfig } from "@/lib/types/config"
import { originAllowed } from "@/lib/origin-guard"
import { buildSessionOpener } from "@/lib/session-opener"

/**
 * GET /api/widget/opener?key=pk_…&address=0x…&chainId=…
 *
 * What to open with, given who just connected. Returns 204 when there is
 * nothing worth saying, and the widget keeps its normal greeting. Silence is a
 * supported answer here, not a failure.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export const dynamic = "force-dynamic"
export const maxDuration = 20

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function nothing() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function isPublicSurface(key: string, config: { publicDemo?: boolean } | null | undefined): boolean {
  const a = process.env.DEMO_WIDGET_KEY
  const b = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY
  return (!!a && key === a) || (!!b && key === b) || config?.publicDemo === true
}

export async function GET(request: Request) {
  // Unauthenticated by design (the publishable key is embedded in the page),
  // so this is an open proxy to chain reads we pay for and are rate limited on
  // upstream. The cap is per IP, generous enough that a real user never sees
  // it and tight enough that a script cannot drain the budget.
  const { allowed } = await rateLimit(`opener:${clientIp(request)}`, 30, 60_000)
  if (!allowed) return nothing()

  const url = new URL(request.url)
  const key = url.searchParams.get("key")
  const address = url.searchParams.get("address")
  const chainId = url.searchParams.get("chainId")

  if (!key?.startsWith("pk_") || !address || !chainId) return nothing()

  const supabase = createServiceClient()
  const { data: project } = await supabase
    .from("projects")
    .select("name, config")
    .eq("publishable_key", key)
    .maybeSingle()
  if (!project) return nothing()

  const typed = project as unknown as { name: string; config: ProjectConfig }
  const config = typed.config ?? ({} as ProjectConfig)
  // Chain reads on an unauthenticated endpoint: a lifted key could burn the
  // project's RPC quota from anywhere, throttling the paying customer.
  if (!originAllowed(request, config.allowedDomains, { publicSurface: isPublicSurface(key, config) })) {
    return nothing()
  }
  if (config.proactiveOpener?.enabled === false) return nothing()

  try {
    const opener = await buildSessionOpener(config, address, chainId, typed.name)
    if (!opener) return nothing()
    return new Response(JSON.stringify(opener), {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "private, max-age=60",
      },
    })
  } catch {
    // Never turn a proactive nicety into a visible error.
    return nothing()
  }
}
