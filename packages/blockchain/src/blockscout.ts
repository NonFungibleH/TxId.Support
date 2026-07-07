// Unified block-explorer access: try Etherscan V2 first, then fall back to
// Blockscout (free, keyless) for chains Etherscan's free tier doesn't cover
// (Base, Optimism, Polygon, Arbitrum). Both expose the same Etherscan-style
// module/action API, so callers build one param set and get one response shape.

const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api"

// Our hex chain IDs → Etherscan V2 numeric chain IDs.
export const ETHERSCAN_CHAIN_IDS: Record<string, number> = {
  "0x1": 1, "0x2105": 8453, "0x38": 56, "0x89": 137, "0xa4b1": 42161, "0xa": 10, "0xaa36a7": 11155111,
}

// Blockscout instances (Etherscan-compatible API). Ethereum is intentionally
// omitted — Etherscan's free tier covers it. BSC has no official Blockscout.
const BLOCKSCOUT_BASES: Record<string, string> = {
  "0x2105": "https://base.blockscout.com",
  "0xa": "https://optimism.blockscout.com",
  "0x89": "https://polygon.blockscout.com",
  "0xa4b1": "https://arbitrum.blockscout.com",
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

/** Whether we can reach an explorer (Etherscan or Blockscout) for this chain. */
export function hasExplorer(chainId: string): boolean {
  return ETHERSCAN_CHAIN_IDS[chainId] !== undefined || BLOCKSCOUT_BASES[chainId] !== undefined
}
