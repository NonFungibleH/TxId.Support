import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"
import { log } from "@/lib/logger"
import { recordIdentity, currentWallet } from "@/lib/identity/store"

/**
 * POST /api/v1/identity - tell us which wallet belongs to which customer.
 *
 * The Console's whole premise is that a support agent has an email address and
 * never a transaction hash. This is how a protocol closes that gap: call it
 * once when an account links a wallet, and again whenever it changes.
 *
 * Authenticated with the project's SECRET key, like /resolve: this writes, and
 * a publishable key sits in plain HTML on a customer's page.
 *
 * Storage is append-only history, so a later call supersedes an earlier pair
 * rather than erasing it. A case answered last March is still readable against
 * the wallet that customer held in March.
 */
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

// EVM 40-hex, or Aptos/Move up to 64. Deliberately permissive on length rather
// than per-chain: rejecting a valid address is worse than storing an odd one.
const WALLET_RE = /^0x[0-9a-fA-F]{40,64}$/
const SOURCES = new Set(["pushed", "crm_field", "manual"])

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extra },
  })
}

function readKey(request: Request): string | null {
  const auth = request.headers.get("authorization")
  if (auth?.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim()
  return request.headers.get("x-api-key")?.trim() ?? null
}

async function authorise(request: Request) {
  const key = readKey(request)
  if (!key || !key.startsWith("sk_")) {
    return { error: json({ error: "Missing or invalid API key. Pass your secret key as 'Authorization: Bearer sk_…'." }, 401) }
  }
  const { allowed } = await rateLimit(`api:${key}`, 60, 60_000)
  if (!allowed) {
    return { error: json({ error: "Rate limit exceeded (60 requests/minute)." }, 429, { "Retry-After": "60" }) }
  }
  const supabase = createServiceClient()
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("secret_key", key)
    .maybeSingle()
  if (!project) return { error: json({ error: "API key not recognised." }, 401) }
  return { projectId: (project as { id: string }).id }
}

export async function POST(request: Request) {
  try {
    const auth = await authorise(request)
    if ("error" in auth) return auth.error

    let body: Record<string, unknown>
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return json({ error: "Invalid JSON body." }, 400)
    }

    const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")
    const customerRef = str(body.customer_id) || str(body.customer_ref)
    const wallet = str(body.wallet)
    const chain = str(body.chain)
    const email = str(body.email) || null
    const displayName = str(body.name) || null
    const source = str(body.source) || "pushed"

    if (!customerRef) return json({ error: "Field 'customer_id' is required: your own identifier for the customer." }, 400)
    if (!WALLET_RE.test(wallet)) return json({ error: "Field 'wallet' must be a 0x-prefixed address." }, 400)
    if (!chain) return json({ error: "Field 'chain' is required, for example 'aptos' or '0x1'." }, 400)
    if (!SOURCES.has(source)) return json({ error: "Field 'source' must be 'pushed', 'crm_field' or 'manual'." }, 400)

    const result = await recordIdentity(auth.projectId, {
      customerRef, wallet, chain,
      source: source as "pushed" | "crm_field" | "manual",
      email, displayName,
    })
    if (!result.ok) {
      log.error("identity write failed", null, { event: "api.identity_failed", reason: result.reason })
      return json({ error: "Could not store the mapping." }, 500)
    }

    log.info("API identity", { event: "api.identity", projectId: auth.projectId, superseded: result.superseded })
    return json({ ok: true, customer_id: customerRef, wallet, chain, superseded_previous: result.superseded }, 200)
  } catch (err) {
    log.error("API identity error", err, { event: "api.identity_error" })
    return json({ error: "Server error." }, 500)
  }
}

/** GET ?customer_id=… - read back what we hold, so an integration is checkable. */
export async function GET(request: Request) {
  try {
    const auth = await authorise(request)
    if ("error" in auth) return auth.error

    const customerRef = new URL(request.url).searchParams.get("customer_id")?.trim()
    if (!customerRef) return json({ error: "Query parameter 'customer_id' is required." }, 400)

    const record = await currentWallet(auth.projectId, customerRef)
    if (!record) return json({ error: "No wallet on record for that customer." }, 404)
    return json({
      customer_id: record.customerRef,
      wallet: record.wallet,
      chain: record.chain,
      email: record.email,
      source: record.source,
      recorded_at: record.createdAt,
    }, 200)
  } catch (err) {
    log.error("API identity read error", err, { event: "api.identity_read_error" })
    return json({ error: "Server error." }, 500)
  }
}
