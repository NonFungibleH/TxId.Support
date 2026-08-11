import { diagnoseTransaction, CHAIN_CONFIGS } from "@txid/blockchain"
import { verdictFor } from "@/lib/tx-verdict"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { log } from "@/lib/logger"

/**
 * PUBLIC transaction checker. No key, no account: this powers the free
 * standalone tool at txid.support/tx, whose whole job is to reach a support
 * agent mid-ticket who will never sign up.
 *
 * COST IS THE DESIGN CONSTRAINT. The diagnosis is fully deterministic (a chain
 * read plus a template verdict, no LLM), so the only spend is the RPC/indexer
 * call, and two things bound it: a per-IP rate limit, and an in-memory cache
 * keyed on the hash. A mined transaction never changes, so a repeat lookup is
 * free. Turnstile is honoured when present but not required, because the rate
 * limit already caps the RPC cost and a hard bot-check would blunt the "paste
 * and go" utility this is trying to be.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const TX_RE = /^0x[0-9a-fA-F]{64}$/

// Terminal results are immutable, so cache them long. Pending / not-found can
// still change (a pending tx confirms, a mistyped hash gets fixed), so cache
// them briefly to soak up double-clicks without pinning a transient answer.
const TERMINAL_TTL_MS = 60 * 60_000
const TRANSIENT_TTL_MS = 20_000
const cache = new Map<string, { at: number; ttl: number; body: string }>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  })
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ip = clientIp(request)
    // Generous but real: this guards RPC/indexer spend, not an LLM bill.
    const { allowed } = await rateLimit(`check:${ip}`, 20, 60_000, { degradedLimit: 8 })
    if (!allowed) {
      return json({ error: "Too many checks in a short time. Please wait a moment and try again." }, 429)
    }

    const body = (await request.json().catch(() => ({}))) as {
      hash?: unknown
      chain?: unknown
    }

    const hash = typeof body.hash === "string" ? body.hash.trim() : ""
    if (!TX_RE.test(hash)) {
      return json({ error: "That doesn't look like a transaction hash. It should start with 0x and be 66 characters long." }, 400)
    }

    // Optional chain: named = one lookup (cheap), absent = auto-detect across
    // the supported set. Ignore an unknown chain rather than erroring, so a
    // stale value from the client just falls back to auto.
    const chain = typeof body.chain === "string" && CHAIN_CONFIGS[body.chain] ? body.chain : undefined

    const cacheKey = `${chain ?? "auto"}:${hash.toLowerCase()}`
    const cached = cache.get(cacheKey)
    if (cached && Date.now() - cached.at < cached.ttl) {
      return new Response(cached.body, {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "hit" },
      })
    }

    const diagnosis = await diagnoseTransaction(hash, chain)
    const verdict = verdictFor(diagnosis)

    const payload = JSON.stringify({ hash, diagnosis, verdict })
    const ttl = diagnosis.status === "success" || diagnosis.status === "failed"
      ? TERMINAL_TTL_MS
      : TRANSIENT_TTL_MS
    cache.set(cacheKey, { at: Date.now(), ttl, body: payload })
    // Bound the map so a flood of distinct hashes can't grow it without limit.
    if (cache.size > 5000) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 1000)
      for (const [k] of oldest) cache.delete(k)
    }

    log.info("Public tx check", { event: "check.diagnose", status: diagnosis.status, chain: diagnosis.chainId ?? "none" })

    return new Response(payload, {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json", "X-Cache": "miss" },
    })
  } catch (err) {
    log.error("Public tx check failed", err, { event: "check.error" })
    return json({ error: "Something went wrong reading that transaction. Please try again." }, 500)
  }
}
