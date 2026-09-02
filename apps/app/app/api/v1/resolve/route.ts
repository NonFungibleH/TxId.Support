import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"
import { log } from "@/lib/logger"
import { resolveByHash } from "@/lib/resolution/gather"
import { recordResolution } from "@/lib/resolution/record"
import { chainStateAt } from "@/lib/evidence"
import type { Intent } from "@/lib/resolution/types"

/**
 * POST /api/v1/resolve - the Resolution API.
 *
 * Returns the TxID Resolution Object: one typed statement about one attempted
 * on-chain action. Spec: docs/superpowers/specs/2026-08-25-resolution-object-spec.md
 *
 * HOW THIS DIFFERS FROM /api/v1/diagnose, which stays exactly as it is:
 *   - diagnose returns the older ad-hoc shape (prose plus a loose cause string)
 *     and covers EVM only. Existing integrations keep working, untouched.
 *   - resolve returns the structured object every TxID product consumes, and
 *     covers Aptos as well as EVM.
 *
 * Auth:  Authorization: Bearer sk_live_…   (the project's secret key)
 * Body:  { "tx": "0x…", "chain"?: "0x2105" | "aptos",
 *          "intent"?: "swap", "intent_met"?: false,
 *          "offchain_state"?: "compliance_review" }
 *
 * `intent` and `offchain_state` are how a caller supplies what the chain cannot
 * know. offchain_state outranks chain status on purpose: "no transaction
 * exists" is the wrong answer when the truth is "not created yet".
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

const TX_RE = /^0x[0-9a-fA-F]{64}$/

const INTENTS = new Set<Intent>([
  "swap", "transfer", "approve", "deposit", "withdraw", "stake", "unstake",
  "claim", "bridge", "mint", "burn", "place_order", "cancel_order", "lock", "other",
])
const OFFCHAIN_STATES = new Set(["compliance_review", "operator_approval", "hold", "settled"])

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

export async function POST(request: Request) {
  try {
    const key = readKey(request)
    if (!key || !key.startsWith("sk_")) {
      return json({ error: "Missing or invalid API key. Pass your secret key as 'Authorization: Bearer sk_…'." }, 401)
    }

    const { allowed } = await rateLimit(`api:${key}`, 60, 60_000)
    if (!allowed) {
      return json({ error: "Rate limit exceeded (60 requests/minute)." }, 429, { "Retry-After": "60" })
    }

    let body: { tx?: unknown; chain?: unknown; intent?: unknown; intent_met?: unknown; offchain_state?: unknown }
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
    const intent = typeof body.intent === "string" && INTENTS.has(body.intent as Intent)
      ? (body.intent as Intent)
      : undefined
    const offchain = typeof body.offchain_state === "string" && OFFCHAIN_STATES.has(body.offchain_state)
      ? (body.offchain_state as "compliance_review" | "operator_approval" | "hold" | "settled")
      : undefined
    const intentMet = typeof body.intent_met === "boolean" ? body.intent_met : undefined

    const supabase = createServiceClient()
    const { data: project } = await supabase
      .from("projects")
      .select("id, config")
      .eq("secret_key", key)
      .single()
    if (!project) {
      return json({ error: "Invalid API key." }, 401)
    }

    // The project's own watched contracts supply protocol error maps, so a
    // customer's Move aborts decode with their protocol's meanings, not generic
    // module-and-code wording.
    const watched = (project.config as { watchedContracts?: { address: string; chain: string }[] } | null)
      ?.watchedContracts
    // The chain height this answer is true as of, so a reviewer can replay it.
    // `chain_state_at` was never set on the API path: the widget stamped its
    // records and the API did not, so the product on slide 11 could not make
    // the claim on slide 8. When the caller names the chain, the stamp runs
    // alongside resolution and costs nothing; otherwise it runs after, only
    // for a chain the transaction was actually found on. Either way a failed
    // read degrades to no stamp, never to an invented one.
    const earlyState = chain ? chainStateAt(chain) : Promise.resolve(undefined)
    const resolution = await resolveByHash(tx, {
      ...(chain ? { chain } : {}),
      ...(intent ? { intent } : {}),
      ...(intentMet === undefined ? {} : { intentMet }),
      ...(offchain ? { offchainState: offchain } : {}),
      ...(watched ? { watchedContracts: watched } : {}),
    })
    const state = (await earlyState) ?? (resolution.chain ? await chainStateAt(resolution.chain) : undefined)
    const height = state?.blockNumber ?? state?.ledgerVersion
    const stamped = height ? { ...resolution, chain_state_at: height } : resolution

    // Deliberately not awaited: the caller gets their answer at the same speed
    // whether or not the stats write lands, and recordResolution never throws.
    void recordResolution(stamped, {
      projectId: project.id,
      source: "api",
      ...(chain ? { chain } : {}),
      txHash: tx,
    })

    log.info("API resolve", {
      event: "api.resolve",
      projectId: project.id,
      code: stamped.txid_code,
      status: stamped.status,
      basis: stamped.basis,
      ...(height ? { chainStateAt: height } : {}),
    })

    return json(stamped, 200)
  } catch (err) {
    log.error("API resolve error", err, { event: "api.resolve_error" })
    return json({ error: "Server error." }, 500)
  }
}
