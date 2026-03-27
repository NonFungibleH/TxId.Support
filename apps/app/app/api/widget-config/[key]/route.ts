import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * GET /api/widget-config/[key]
 *
 * Returns the safe-to-expose widget configuration for a publishable key.
 * Only includes branding, chain list, token symbol/chain — never secret_key.
 */
export async function GET(
  _request: Request,
  { params }: { params: { key: string } },
) {
  const { key } = params

  if (!key || !key.startsWith("pk_")) {
    return new Response(JSON.stringify({ error: "Invalid key" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  const supabase = createServiceClient()

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, config, is_active, mode")
    .eq("publishable_key", key)
    .single()

  if (error || !project) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  const typedProject = project as unknown as ProjectRow & { name: string; is_active: boolean }

  if (!typedProject.is_active) {
    return new Response(JSON.stringify({ error: "Project inactive" }), {
      status: 403,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  const config = typedProject.config as unknown as ProjectConfig

  // Only return safe fields — never secret_key, org_id, etc.
  const publicConfig = {
    projectId: typedProject.id,
    projectName: typedProject.name,
    mode: (typedProject as unknown as { mode?: string }).mode ?? "support",
    branding: config.branding,
    chains: config.chains,
    token: config.token
      ? {
          symbol: config.token.symbol,
          chain: config.token.chain,
          dexUrl: config.token.dexUrl,
          address: config.token.address,
        }
      : null,
    community: config.community ?? null,
    tokenModeAsk: config.tokenModeAsk ?? null,
    watchedContracts: (config.watchedContracts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      chain: c.chain,
      description: c.description,
      address: c.address,
    })),
  }

  return new Response(JSON.stringify(publicConfig), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=60",
    },
  })
}
