import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
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

export async function GET(request: Request) {
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
