import { CHAIN_CONFIGS } from "./types"

/**
 * One JSON-RPC call, retried once on a THROTTLE or a transient failure.
 *
 * WHY THE RETRY. `diagnoseWallet` fires six of these, several concurrently,
 * and a single failure among them collapses the whole diagnosis into "I could
 * not reach the chain". Observed live: the three-call gas query succeeded while
 * the six-call diagnosis failed seconds later against the same endpoint, which
 * is the signature of a per-second cap rather than an outage. Losing the most
 * valuable answer we have to one unlucky call in six is not a trade worth
 * making when the fix is one retry.
 *
 * Retried on 429 and 5xx and on a network throw. NOT retried on other 4xx: a
 * 401 from a bad key or a 404 from a wrong URL will fail identically the second
 * time, and hammering it turns a configuration mistake into a rate-limit one.
 */
async function rpc(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok) {
        const json = (await res.json()) as { result?: unknown }
        return json.result ?? null
      }
      const worthRetrying = res.status === 429 || res.status >= 500
      if (!worthRetrying || attempt === 1) return null
    } catch {
      if (attempt === 1) return null
    }
    // Brief, jittered, so six concurrent calls do not all retry in lockstep
    // and reproduce the burst that throttled them.
    await new Promise(r => setTimeout(r, 250 + Math.floor(Math.random() * 250)))
  }
  return null
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

export interface WalletRpcDiagnosis {
  chainId: string
  /** Human name of the chain the wallet is connected to (e.g. "Base"). */
  chainName: string
  nativeCurrency: string
  /** Did the chain's public RPC respond at all? false → the chain (or its RPC) is down. */
  networkResponsive: boolean
  /** Human-readable native balance, e.g. "0.0123". Absent if the RPC didn't answer. */
  nativeBalance?: string
  /** True when the wallet is effectively empty and cannot pay gas for anything. */
  outOfGasFunds?: boolean
  /** Confirmed transaction count = the next nonce the chain expects. */
  confirmedNonce?: number
  /** Nonce including still-pending txs. */
  pendingNonce?: number
  /** Pending txs stuck in the mempool that block every newer tx until they clear/are replaced. */
  stuckPendingTxs?: number
  /** Recommended max fee (gwei) if the wallet's RPC is under-pricing gas. */
  suggestedMaxFeeGwei?: string
}

/**
 * Wallet-level RPC health check for the connected wallet, run against the
 * chain's own public RPC. Surfaces the failures that happen BEFORE a tx ever
 * lands — an empty gas balance, a stuck pending nonce blocking new sends, or
 * an unresponsive network — so the bot can diagnose "nothing works / my
 * transactions won't go through" without needing a tx hash. Chain-mismatch
 * (wallet on the wrong network) is judged by the caller against the protocol's
 * contracts. Returns null for unknown/non-EVM chains.
 */
export async function diagnoseWalletRpc(
  address: string,
  chainId: string,
): Promise<WalletRpcDiagnosis | null> {
  const cfg = CHAIN_CONFIGS[chainId]
  if (!cfg?.rpcUrl) return null
  const rpcUrl = cfg.rpcUrl

  const [status, balanceRaw, latestRaw, pendingRaw] = (await Promise.all([
    getNetworkStatus(chainId),
    rpc(rpcUrl, "eth_getBalance", [address, "latest"]),
    rpc(rpcUrl, "eth_getTransactionCount", [address, "latest"]),
    rpc(rpcUrl, "eth_getTransactionCount", [address, "pending"]),
  ])) as [NetworkStatus | null, string | null, string | null, string | null]

  const networkResponsive = !!status?.responsive || balanceRaw !== null
  const out: WalletRpcDiagnosis = {
    chainId,
    chainName: cfg.name,
    nativeCurrency: cfg.nativeCurrency,
    networkResponsive,
  }
  const toBig = (h: string | null) => {
    if (!h) return null
    try { return BigInt(h) } catch { return null }
  }
  const bal = toBig(balanceRaw)
  if (bal !== null) {
    out.nativeBalance = (Number(bal) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })
    // Effectively empty: below ~0.00005 native, not enough to cover even cheap L2 gas.
    out.outOfGasFunds = bal < 50_000_000_000_000n
  }
  const latest = toBig(latestRaw)
  const pending = toBig(pendingRaw)
  if (latest !== null) out.confirmedNonce = Number(latest)
  if (pending !== null) out.pendingNonce = Number(pending)
  if (latest !== null && pending !== null) {
    out.stuckPendingTxs = pending > latest ? Number(pending - latest) : 0
  }
  if (status?.suggestedMaxFeeGwei) out.suggestedMaxFeeGwei = status.suggestedMaxFeeGwei
  return out
}
