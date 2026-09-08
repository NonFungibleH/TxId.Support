/**
 * Reading Stellar, which is the easiest of the non-EVM chains so far.
 *
 * TWO endpoints, deliberately, because they answer different questions:
 *
 *  - HORIZON (`horizon.stellar.org`) is the historical API: accounts, balances,
 *    and a transaction's full record. Keyless, no rate-limit trouble observed.
 *  - SOROBAN RPC is the JSON-RPC node. `getTransactions` returns a whole ledger
 *    range with statuses in ONE call, which is what makes a failure census cheap
 *    here, and it is the only route to Soroban contract detail.
 *
 * Both are keyless and both were verified live on 2026-09-07. Three independent
 * Soroban RPC providers answered healthy on the same ledger, which is a better
 * position than Sui (whose own fullnode has dropped JSON-RPC entirely and left
 * us on two third parties).
 *
 * NOTE FOR ANYONE RE-CHECKING THIS: a GET against a Soroban RPC returns 405 and
 * looks like a dead endpoint. It is JSON-RPC, so it wants a POST. That mistake
 * cost this integration a place in the build order until it was caught.
 */
const DEFAULT_SOROBAN = [
  "https://mainnet.sorobanrpc.com",
  "https://soroban-rpc.mainnet.stellar.gateway.fm",
  "https://rpc.ankr.com/stellar_soroban",
]
const DEFAULT_HORIZON = ["https://horizon.stellar.org"]

function fromEnv(raw: string | undefined, fallback: string[], label: string): string[] {
  if (!raw) return fallback
  const list = raw.split(",").map(s => s.trim()).filter(s => /^https?:\/\//i.test(s))
  // A set-but-useless value is the dangerous case: someone believes they have
  // moved off the public endpoints when they have not. Say so.
  if (list.length === 0) {
    console.warn(`[stellar] ${label} is set but contains no usable http(s) endpoints. Using the public ones.`)
    return fallback
  }
  return list
}

export const sorobanEndpoints = () => fromEnv(process.env.STELLAR_SOROBAN_URLS, DEFAULT_SOROBAN, "STELLAR_SOROBAN_URLS")
export const horizonEndpoints = () => fromEnv(process.env.STELLAR_HORIZON_URLS, DEFAULT_HORIZON, "STELLAR_HORIZON_URLS")

export type Outcome =
  | { ok: true; result: unknown }
  | { ok: false; kind: "not_found"; reason: string }
  | { ok: false; kind: "unavailable"; reason: string }

/**
 * One JSON-RPC call across the Soroban endpoint list. A JSON-RPC `error` object
 * is a node DECLINING to answer, not an answer, so it does not stop the
 * fallback.
 */
export async function soroban(method: string, params: unknown, timeoutMs = 15_000): Promise<Outcome> {
  let lastReason = "no Soroban endpoint answered"
  for (const url of sorobanEndpoints()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) { lastReason = `${new URL(url).host} returned ${res.status}`; continue }
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } }
      if (body.error) { lastReason = body.error.message ?? "the node declined the request"; continue }
      if (body.result === undefined) { lastReason = `${new URL(url).host} returned no result`; continue }
      return { ok: true, result: body.result }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "network error"
    }
  }
  return { ok: false, kind: "unavailable", reason: lastReason }
}

/**
 * One GET against Horizon. A 404 is an ANSWER (Horizon looked and has no such
 * thing) and is reported as `not_found`; everything else is a failure to ask.
 */
export async function horizon(path: string, timeoutMs = 15_000): Promise<Outcome> {
  let lastReason = "no Horizon endpoint answered"
  for (const base of horizonEndpoints()) {
    try {
      const res = await fetch(`${base}${path}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.status === 404) return { ok: false, kind: "not_found", reason: "Horizon has no record of it" }
      if (!res.ok) { lastReason = `${new URL(base).host} returned ${res.status}`; continue }
      return { ok: true, result: await res.json() }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "network error"
    }
  }
  return { ok: false, kind: "unavailable", reason: lastReason }
}
