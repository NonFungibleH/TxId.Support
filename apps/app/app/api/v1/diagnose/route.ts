import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"
import { log } from "@/lib/logger"
import { diagnoseTransaction } from "@txid/blockchain"

// Server-to-server API. CORS is permissive so it works from any backend/edge,
// but the secret key must never be shipped to a browser.
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

const TX_RE = /^0x[0-9a-fA-F]{64}$/

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extra },
  })
}

/** Extract the bearer token from the Authorization header (or x-api-key). */
function readKey(request: Request): string | null {
  const auth = request.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim()
  return request.headers.get("x-api-key")?.trim() ?? null
}

/**
 * POST /api/v1/diagnose  — headless transaction diagnosis.
 *
 * Auth:  Authorization: Bearer sk_live_…   (the project's secret key)
 * Body:  { "tx": "0x…", "chain"?: "0x2105" }
 * Reply: { status, chain, cause, error, explanation, fix, tokenTransfers, gas, method }
 */
export async function POST(request: Request) {
  try {
    const key = readKey(request)
    if (!key || !key.startsWith("sk_")) {
      return json({ error: "Missing or invalid API key. Pass your secret key as 'Authorization: Bearer sk_…'." }, 401)
    }

    // Rate limit per key (independent of the widget's conversation quota).
    const { allowed } = await rateLimit(`api:${key}`, 60, 60_000)
    if (!allowed) {
      return json({ error: "Rate limit exceeded (60 requests/minute)." }, 429, { "Retry-After": "60" })
    }

    let body: { tx?: unknown; chain?: unknown }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return json({ error: "Invalid JSON body." }, 400)
    }

    const tx = typeof body.tx === "string" ? body.tx.trim() : ""
    if (!TX_RE.test(tx)) {
      return json({ error: "Field 'tx' must be a 0x-prefixed 66-character transaction hash." }, 400)
    }
    const chain = typeof body.chain === "string" ? body.chain.trim() : undefined

    const supabase = createServiceClient()
    const { data: project } = await supabase
      .from("projects")
      .select("id")
      .eq("secret_key", key)
      .single()
    if (!project) {
      return json({ error: "Invalid API key." }, 401)
    }

    const diagnosis = await diagnoseTransaction(tx, chain)
    log.info("API diagnose", { event: "api.diagnose", projectId: project.id, status: diagnosis.status })

    return json({ tx, ...diagnosis }, 200)
  } catch (err) {
    log.error("API diagnose error", err, { event: "api.diagnose_error" })
    return json({ error: "Server error." }, 500)
  }
}
