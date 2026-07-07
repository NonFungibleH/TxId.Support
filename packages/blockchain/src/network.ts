import { CHAIN_CONFIGS } from "./types"

async function rpc(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: unknown }
    return json.result ?? null
  } catch {
    return null
  }
}

function gwei(wei: bigint): string {
  return (Number(wei) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export interface NetworkStatus {
  chainId: string
  nativeCurrency: string
  responsive: boolean
  blockNumber?: number
  gasPriceGwei?: string
  baseFeeGwei?: string
  priorityFeeGwei?: string
  suggestedMaxFeeGwei?: string
}

/**
 * Live network status for a chain: current gas price, base fee, a recommended
 * "set at least" max fee, latest block, and whether the chain's RPC responded.
 * Uses the chain's public RPC. Returns null if the chain is unknown or the RPC
 * is unreachable.
 */
export async function getNetworkStatus(chainId: string): Promise<NetworkStatus | null> {
  const cfg = CHAIN_CONFIGS[chainId]
  if (!cfg?.rpcUrl) return null
  const rpcUrl = cfg.rpcUrl

  const [gasPriceRaw, blockRaw, priorityRaw] = (await Promise.all([
    rpc(rpcUrl, "eth_gasPrice", []),
    rpc(rpcUrl, "eth_getBlockByNumber", ["latest", false]),
    rpc(rpcUrl, "eth_maxPriorityFeePerGas", []),
  ])) as [string | null, { number?: string; baseFeePerGas?: string } | null, string | null]

  const responsive = !!(gasPriceRaw || blockRaw)
  if (!responsive) return null

  const out: NetworkStatus = { chainId, nativeCurrency: cfg.nativeCurrency, responsive: true }
  const toBig = (h: string | null | undefined) => {
    if (!h) return null
    try { return BigInt(h) } catch { return null }
  }
  const gasPrice = toBig(gasPriceRaw)
  const baseFee = toBig(blockRaw?.baseFeePerGas)
  const block = toBig(blockRaw?.number)
  // Priority fee: use the node's suggestion, else derive from gasPrice-baseFee, else a safe 1.5 gwei.
  const priority = toBig(priorityRaw) ?? (gasPrice && baseFee && gasPrice > baseFee ? gasPrice - baseFee : 1_500_000_000n)

  if (block !== null) out.blockNumber = Number(block)
  if (gasPrice !== null) out.gasPriceGwei = gwei(gasPrice)
  if (baseFee !== null) {
    out.baseFeeGwei = gwei(baseFee)
    out.priorityFeeGwei = gwei(priority)
    // Safe headroom so the tx is included even if the base fee ticks up.
    out.suggestedMaxFeeGwei = gwei(baseFee * 2n + priority)
  } else if (gasPrice !== null) {
    out.suggestedMaxFeeGwei = gwei((gasPrice * 12n) / 10n) // legacy chain: +20%
  }
  return out
}
