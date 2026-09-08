// Unified block-explorer access: try Etherscan V2 first, then fall back to
// Blockscout (free, keyless) for chains Etherscan's free tier doesn't cover
// (Base, Optimism, Polygon, Arbitrum). Both expose the same Etherscan-style
// module/action API, so callers build one param set and get one response shape.

const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api"

// Our hex chain IDs → Etherscan V2 numeric chain IDs.
export const ETHERSCAN_CHAIN_IDS: Record<string, number> = {
  "0x1": 1, "0x2105": 8453, "0x38": 56, "0x89": 137, "0xa4b1": 42161, "0xa": 10, "0xa86a": 43114, "0xaa36a7": 11155111,
  // Etherscan V2 is ONE key across every chain it covers, so adding a chain here
  // costs no new credential. Confirmed against its own /v2/chainlist on
  // 2026-09-08: Monad Mainnet, id 143, status 1 (ok), explorer monadscan.com.
  "0x8f": 143,
  "0x3e7": 999,
  "0x82": 130,
  "0x2611": 9745,
  "0x1388": 5000,
}

// Etherscan-compatible fallback explorers (Blockscout / Routescan), used when
// Etherscan V2 doesn't cover a call for a chain. Ethereum is omitted (V2 free
// tier covers it); BSC has no official instance. Avalanche uses Routescan —
// Etherscan V2 serves getabi for 43114 but NOT getcontractcreation, so the
// deployment lookup needs this fallback.
const BLOCKSCOUT_BASES: Record<string, string> = {
  "0x2105": "https://base.blockscout.com",
  "0xa": "https://optimism.blockscout.com",
  "0x89": "https://polygon.blockscout.com",
  "0xa4b1": "https://arbitrum.blockscout.com",
  "0xa86a": "https://api.routescan.io/v2/network/mainnet/evm/43114/etherscan",
  "0xa729": "https://explorer.etherlink.com",
  "0x82": "https://unichain.blockscout.com",
}

export interface ExplorerResponse {
  status: string
  message?: string
  result: unknown
}

async function getJson(url: string): Promise<ExplorerResponse | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    return (await res.json()) as ExplorerResponse
  } catch {
    return null
  }
}

/**
 * Query an Etherscan-compatible explorer for a chain. Tries Etherscan V2 and,
 * if that isn't successful (e.g. Base on the free tier), falls back to
 * Blockscout. Returns the raw { status, result } — callers parse as usual.
 */
export async function explorerQuery(
  chainId: string,
  params: Record<string, string>,
): Promise<ExplorerResponse | null> {
  const numericChainId = ETHERSCAN_CHAIN_IDS[chainId]
  if (numericChainId !== undefined) {
    const apiKey = process.env.ETHERSCAN_API_KEY ?? ""
    const qs = new URLSearchParams({
      chainid: String(numericChainId),
      ...params,
      ...(apiKey ? { apikey: apiKey } : {}),
    })
    const r = await getJson(`${ETHERSCAN_V2_BASE}?${qs.toString()}`)
    if (r && r.status === "1" && r.result) return r
  }
  const base = BLOCKSCOUT_BASES[chainId]
  if (base) {
    const qs = new URLSearchParams(params)
    const r = await getJson(`${base}/api?${qs.toString()}`)
    if (r) return r
  }
  return null
}

/**
 * An explorer answer that distinguishes NOTHING FOUND from NOBODY ANSWERED.
 *
 * `explorerQuery` above returns `ExplorerResponse | null` and cannot tell the
 * two apart, because both arrive as a `status` that is not "1". That is the
 * same conflation `aptosGet` had, and it hid the same class of bug one layer
 * below the code you are reading.
 *
 * IT IS NOT THEORETICAL, AND IT IS LIVE. Etherscan V2 answers an unkeyed
 * request with HTTP 200 and `{status:"0", message:"NOTOK", result:"Missing/
 * Invalid API Key"}`, which is indistinguishable here from `{status:"0",
 * message:"No records found"}`. `ETHERSCAN_API_KEY` is unset in production, and
 * Ethereum has no Blockscout fallback configured, so on 2026-09-08 every log
 * query on mainnet returned null and every caller read that as an empty
 * result. Verified against USDC, a proxy upgraded several times, which
 * `getUpgradeHistory` reported as never upgraded.
 *
 * `explorerQuery` is unchanged and still fine for optional fields. Anything
 * whose answer reaches a user goes through this.
 */
export type ExplorerRead =
  | { kind: "ok"; result: unknown }
  /** An explorer answered and genuinely holds no such records. A FINDING. */
  | { kind: "empty" }
  /** Nobody answered. Never a finding. */
  | { kind: "unavailable"; reason: string }

/**
 * Etherscan and Blockscout both report a genuine miss as status "0" with a
 * "No … found" message, and report errors as status "0" with "NOTOK". The
 * message is the only thing separating them, so it is read rather than ignored.
 */
function classify(r: ExplorerResponse | null, source: string): ExplorerRead {
  if (!r) return { kind: "unavailable", reason: `${source} could not be reached` }
  if (r.status === "1") return { kind: "ok", result: r.result }
  const message = String(r.message ?? "")
  if (/^no .*(found|records)/i.test(message)) return { kind: "empty" }
  const detail = typeof r.result === "string" && r.result ? r.result : message || "no reason given"
  return { kind: "unavailable", reason: `${source} declined the request: ${detail}` }
}

/**
 * Query the explorers for a chain, keeping the three outcomes apart.
 *
 * A definite answer from EITHER explorer wins, including a definite empty: an
 * explorer that is working and holds no matching records has answered the
 * question. `unavailable` is reserved for nobody having answered at all.
 */
export async function explorerRead(
  chainId: string,
  params: Record<string, string>,
): Promise<ExplorerRead> {
  let sawEmpty = false
  let reason = `no explorer is configured for chain ${chainId}`

  const numericChainId = ETHERSCAN_CHAIN_IDS[chainId]
  if (numericChainId !== undefined) {
    const apiKey = process.env.ETHERSCAN_API_KEY ?? ""
    const qs = new URLSearchParams({
      chainid: String(numericChainId),
      ...params,
      ...(apiKey ? { apikey: apiKey } : {}),
    })
    const c = classify(await getJson(`${ETHERSCAN_V2_BASE}?${qs.toString()}`), "Etherscan")
    if (c.kind === "ok") return c
    if (c.kind === "empty") sawEmpty = true
    else reason = c.reason
  }

  const base = BLOCKSCOUT_BASES[chainId]
  if (base) {
    const c = classify(await getJson(`${base}/api?${new URLSearchParams(params).toString()}`), "Blockscout")
    if (c.kind === "ok") return c
    if (c.kind === "empty") sawEmpty = true
    else if (numericChainId === undefined) reason = c.reason
  }

  if (sawEmpty) return { kind: "empty" }
  return { kind: "unavailable", reason }
}

/** Whether we can reach an explorer (Etherscan or Blockscout) for this chain. */
export function hasExplorer(chainId: string): boolean {
  return ETHERSCAN_CHAIN_IDS[chainId] !== undefined || BLOCKSCOUT_BASES[chainId] !== undefined
}
