import { NearLookupUnavailableError } from "./lookup"

/**
 * NEAR JSON-RPC, archival first.
 *
 * THE RETENTION RULE IS THE LOAD-BEARING PART, and it is the Solana finding
 * again on a different chain. Measured 2026-09-08 against the same block
 * heights: `rpc.mainnet.near.org` and `free.rpc.fastnear.com` both serve 50,000
 * blocks back and answer UNKNOWN_BLOCK at 200,000, roughly two days of history.
 * `archival-rpc.mainnet.near.org` served 5,000,000 blocks back, keyless.
 *
 * So a standard node's "I do not have that" is indistinguishable from "that
 * never existed", and the user it reaches is the one asking about a
 * transaction from last month. Every read prefers archival, and an
 * UNKNOWN_BLOCK or UNKNOWN_TRANSACTION from a node we have not established as
 * archival is `unavailable`, never a finding.
 */
const ARCHIVAL = "https://archival-rpc.mainnet.near.org"

/**
 * Whether a node keeps the whole chain, asked OF THAT NODE rather than matched
 * against a hostname. `genesis_config` reports the height its data starts from;
 * an archival node starts at genesis. Cached per endpoint for the process,
 * because it does not change, and it FAILS CLOSED: a node we could not ask is
 * not treated as archival, so its miss stays `unavailable`.
 */
const archivalCache = new Map<string, boolean>()

async function isArchival(url: string): Promise<boolean> {
  const cached = archivalCache.get(url)
  if (cached !== undefined) return cached
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "txid", method: "block", params: { block_id: 1 } }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { result?: unknown; error?: { cause?: { name?: string } } }
    // A node holding block 1 holds everything. UNKNOWN_BLOCK there means it
    // has pruned, which is exactly what we need to know.
    const archival = body.result !== undefined && body.result !== null
    if (archivalCache.size > 20) archivalCache.clear()
    archivalCache.set(url, archival)
    return archival
  } catch {
    return false
  }
}
const STANDARD = ["https://free.rpc.fastnear.com", "https://rpc.mainnet.near.org"]

/** `NEAR_RPC_URLS`, JSON array or comma-separated. Archival endpoints first. */
export function endpoints(): string[] {
  const raw = process.env.NEAR_RPC_URLS?.trim()
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        const urls = parsed.filter((u): u is string => typeof u === "string" && u.startsWith("http"))
        if (urls.length) return urls
      }
    } catch {
      // Not JSON; fall through to the comma-separated form.
    }
    const urls = raw.split(",").map(s => s.trim()).filter(u => u.startsWith("http"))
    if (urls.length) return urls
  }
  // Archival leads: it answers everything the standard nodes do, and more.
  return [ARCHIVAL, ...STANDARD]
}

interface RpcOk<T> { kind: "ok"; value: T }
interface RpcMissing { kind: "missing"; name: string }
interface RpcUnavailable { kind: "unavailable"; reason: string }
export type RpcResult<T> = RpcOk<T> | RpcMissing | RpcUnavailable

/**
 * NEAR reports a genuine miss as a JSON-RPC error with a CAUSE NAME, which is
 * what makes the three states separable at all: UNKNOWN_TRANSACTION and
 * UNKNOWN_ACCOUNT are findings, TIMEOUT_ERROR and UNKNOWN_BLOCK are not.
 *
 * UNKNOWN_BLOCK sits on the unavailable side deliberately. On a pruning node it
 * means "outside what I keep", and there is no way to tell that from a height
 * that never existed without knowing the node's retention.
 */
/**
 * UNKNOWN_ACCOUNT is the one of these NEAR actually sends, and it is what makes
 * `getNearWalletBalance` able to report an account that does not exist as the
 * finding it is. UNKNOWN_TRANSACTION is kept because the RPC documents it, but
 * see the TIMEOUT_ERROR note below: for transactions NEAR times out instead, so
 * that branch is not the one a wrong hash actually takes.
 */
const MISSING_CAUSES = new Set(["UNKNOWN_TRANSACTION", "UNKNOWN_ACCOUNT", "UNKNOWN_RECEIPT", "UNKNOWN_ACCESS_KEY"])

export async function nearRpc<T>(method: string, params: unknown, timeoutMs = 15000): Promise<RpcResult<T>> {
  let lastReason = "no NEAR endpoint is configured"
  let missing: RpcMissing | null = null
  /**
   * WHICH endpoint reported the miss, not merely whether an archival one was
   * configured. Checking the list was the bug: with archival listed but DOWN, a
   * two-day-retention node's UNKNOWN_TRANSACTION was returned as a definite
   * finding and rendered as "an archival NEAR node looked and has no
   * transaction with this hash", which is a claim about evidence that does not
   * exist. The mirror case was just as wrong in the other direction: a custom
   * NEAR_RPC_URLS pointing at an archival provider that is not this exact
   * hostname downgraded every genuine miss to unavailable.
   */
  let missingFrom: string | null = null

  for (const url of endpoints()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: "txid", method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) { lastReason = `a NEAR node returned ${res.status}`; continue }
      let body: { result?: T; error?: { cause?: { name?: string }; name?: string; message?: string } }
      try {
        body = (await res.json()) as typeof body
      } catch {
        lastReason = "a NEAR node returned unreadable JSON"
        continue
      }
      if (body.error) {
        const cause = body.error.cause?.name ?? body.error.name ?? ""
        /**
         * NEAR NEVER ANSWERS "UNKNOWN_TRANSACTION" FOR A HASH THAT DOES NOT
         * EXIST. Measured 2026-09-09 against a well-formed hash with one
         * character changed: both archival-rpc.mainnet.near.org and
         * free.rpc.fastnear.com search for 13 to 33 seconds and then return
         * HTTP 408 with cause TIMEOUT_ERROR. Neither ever reports the miss.
         *
         * That is the NODE giving up on its own search, not a transport
         * failure, so trying the next endpoint just pays the same 13 to 33
         * seconds again. With three endpoints configured a user pasting a
         * wrong hash waited up to 45 seconds to be told we could not check.
         *
         * It stays UNAVAILABLE, because a search that timed out is not
         * evidence the transaction does not exist. It simply stops costing the
         * user the same wait three times over.
         */
        if (cause === "TIMEOUT_ERROR") {
          return {
            kind: "unavailable",
            reason: "the NEAR node searched for this transaction and did not finish in time, which is not a statement that it does not exist. If the hash was copied by hand it is worth checking it.",
          }
        }
        if (MISSING_CAUSES.has(cause)) {
          // A definite miss. Remember it, but keep trying the other endpoints:
          // a node that has pruned the record can report the same thing.
          missing = { kind: "missing", name: cause }
          missingFrom = url
          continue
        }
        lastReason = `a NEAR node declined the request: ${cause || body.error.message || "no reason given"}`
        continue
      }
      if (body.result === undefined || body.result === null) { lastReason = "a NEAR node returned no result"; continue }
      return { kind: "ok", value: body.result }
    } catch (e) {
      lastReason = e instanceof Error && e.name === "TimeoutError"
        ? "a NEAR node did not respond in time"
        : "a NEAR node could not be reached"
    }
  }

  // A miss is only a FINDING if the node that reported it keeps the whole
  // chain. Otherwise it is "not in the part I hold", a different sentence.
  if (missing && missingFrom && (await isArchival(missingFrom))) return missing
  if (missing) {
    return {
      kind: "unavailable",
      reason: "the NEAR node that answered keeps only recent history, so a missing record cannot be reported as one that never existed",
    }
  }
  return { kind: "unavailable", reason: lastReason }
}

/** Throws on unavailable, so callers that cannot express the third state stay honest. */
export function unwrapNear<T>(r: RpcResult<T>): T | null {
  if (r.kind === "unavailable") throw new NearLookupUnavailableError(r.reason)
  return r.kind === "missing" ? null : r.value
}
