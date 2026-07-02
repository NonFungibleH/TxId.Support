import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database, Json } from "@/lib/supabase/types"
import { verifyPreviewToken } from "@/lib/preview-token"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function extractHostname(originOrReferer: string): string | null {
  try {
    return new URL(originOrReferer).hostname.toLowerCase()
  } catch {
    return null
  }
}

const EXEMPT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

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
  request: Request,
  { params }: { params: { key: string } },
) {
  const { key } = params
  const url = new URL(request.url)
  const preview = url.searchParams.get("preview") === "1"
  const previewToken = url.searchParams.get("pt")

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
    if (!preview || !verifyPreviewToken(typedProject.id, previewToken)) {
      return new Response(JSON.stringify({ error: "Project inactive" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }
  }

  const config = typedProject.config as unknown as ProjectConfig

  // ── Domain enforcement ──────────────────────────────────────────────────
  // Skip for preview requests (dashboard preview uses a signed token)
  if (!preview) {
    const originHeader = request.headers.get("origin") ?? request.headers.get("referer")
    const requestHost = originHeader ? extractHostname(originHeader) : null

    if (requestHost && !EXEMPT_HOSTS.has(requestHost)) {
      const allowed = config.allowedDomains ?? []
      if (allowed.length === 0) {
        // Auto-register: first external domain to call this key claims it
        const updated = { ...config, allowedDomains: [requestHost] }
        await supabase
          .from("projects")
          .update({ config: updated as unknown as Json })
          .eq("id", typedProject.id)
      } else {
        const normalised = allowed.map((d) => d.replace(/^https?:\/\//, "").toLowerCase())
        if (!normalised.includes(requestHost)) {
          return new Response(JSON.stringify({ error: "Domain not registered for this key" }), {
            status: 403,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          })
        }
      }
    }
  }

  // Only return safe fields — never secret_key, org_id, etc.
  const publicConfig = {
    projectId: typedProject.id,
    projectName: typedProject.name,
    mode: (typedProject as unknown as { mode?: string }).mode ?? "support",
    branding: config.branding,
    chains: [...new Set([
      ...(config.watchedContracts ?? []).map(c => c.chain as string),
      ...(config.token?.chain ? [config.token.chain as string] : []),
    ])],
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
    welcomeMessage: config.branding?.welcomeMessage ?? null,
    watchedContracts: (config.watchedContracts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      chain: c.chain,
      description: c.description,
      address: c.address,
    })),
    contentBlocks: (config.contentBlocks ?? [])
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        content: b.content,
        order: b.order,
      })),
  }

  return new Response(JSON.stringify(publicConfig), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=15",
    },
  })
}
