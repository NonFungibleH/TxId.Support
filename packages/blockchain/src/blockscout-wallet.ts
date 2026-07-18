// Wallet-data adapter for chains Moralis doesn't index (e.g. Etherlink), using
// the chain's Blockscout v2 REST API for lists/balances and its RPC for single
// transactions + revert decoding. Produces the SAME normalised shapes as the
// Moralis path in wallet.ts, so it's a drop-in behind the same functions.

import { CHAIN_CONFIGS } from "./types"
import type { TokenBalance, NativeBalance, Transaction, DecodedRevert } from "./types"
import { decodeTxRevert } from "./decoder"
import type { WalletApproval } from "./wallet"

function bsBase(chainId: string): string | null {
  return CHAIN_CONFIGS[chainId]?.blockscoutApi ?? null
}

async function bsGet(chainId: string, path: string): Promise<unknown | null> {
  const base = bsBase(chainId)
  if (!base) return null
  try {
    const res = await fetch(`${base}/v2${path}`, { signal: AbortSignal.timeout(9000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function rpc(chainId: string, method: string, params: unknown[]): Promise<string | null> {
  const url = CHAIN_CONFIGS[chainId]?.rpcUrl
  if (!url) return null
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { result?: unknown }
    return body.result === undefined || body.result === null ? null : (body.result as string)
  } catch {
    return null
  }
}

async function rpcObj<T>(chainId: string, method: string, params: unknown[]): Promise<T | null> {
  return (await rpc(chainId, method, params)) as T | null
}

function fmtNative(rawWei: bigint): string {
  return (Number(rawWei) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })
}

function fmtUnits(raw: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const whole = raw / divisor
  const frac = raw % divisor
  if (frac === 0n) return whole.toLocaleString("en-US")
  // Show up to 4 significant fractional digits; if everything rounds away past
  // the 4th place, drop the decimal point entirely rather than emit "1234.".
  const fracDigits = frac.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "")
  return fracDigits ? `${whole.toLocaleString("en-US")}.${fracDigits}` : whole.toLocaleString("en-US")
}

// ── Balances (native via RPC, tokens via Blockscout) ─────────────────────────

export async function bsNativeBalance(address: string, chainId: string): Promise<NativeBalance> {
  const symbol = CHAIN_CONFIGS[chainId]?.nativeCurrency ?? "ETH"
  const hex = await rpc(chainId, "eth_getBalance", [address, "latest"])
  const raw = hex ? BigInt(hex) : 0n
  return { balance: raw.toString(), balanceFormatted: fmtNative(raw), symbol }
}

export async function bsTokenBalances(address: string, chainId: string): Promise<TokenBalance[]> {
  const data = await bsGet(chainId, `/addresses/${address}/token-balances`) as
    | Array<{ token?: { address?: string; symbol?: string; name?: string; decimals?: string; exchange_rate?: string | null; type?: string }; value?: string }>
    | null
  if (!Array.isArray(data)) return []
  return data
    .filter(t => (t.token?.type ?? "ERC-20") === "ERC-20" && t.token?.address)
    .map(t => {
      const decimals = Number(t.token?.decimals ?? "18") || 18
      const raw = (() => { try { return BigInt(t.value ?? "0") } catch { return 0n } })()
      const rate = t.token?.exchange_rate ? Number(t.token.exchange_rate) : null
      const usd = rate !== null ? (Number(raw) / 10 ** decimals) * rate : null
      return {
        tokenAddress: t.token!.address!,
        symbol: t.token?.symbol ?? "?",
        name: t.token?.name ?? "",
        decimals,
        balance: raw.toString(),
        balanceFormatted: fmtUnits(raw, decimals),
        usdValue: usd !== null ? `$${usd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : null,
        logo: null,
      }
    })
    .filter(t => t.balance !== "0")
}

// ── Transaction lists (Blockscout) ───────────────────────────────────────────

interface BsTxItem {
  hash: string
  block_number?: number
  block?: number
  timestamp?: string
  from?: { hash?: string }
  to?: { hash?: string } | null
  value?: string
  gas_limit?: string
  gas_used?: string
  status?: string | null   // "ok" | "error" | null(pending)
  method?: string | null
}

function mapBsTx(tx: BsTxItem, chainId: string): Transaction {
  const symbol = CHAIN_CONFIGS[chainId]?.nativeCurrency ?? "ETH"
  const valueRaw = (() => { try { return BigInt(tx.value ?? "0") } catch { return 0n } })()
  const valueFmt = (Number(valueRaw) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })
  const isFailed = tx.status === "error"
  const gasUsed = tx.gas_used ?? "0"
  const gasLimit = tx.gas_limit ?? "0"
  const to = tx.to?.hash ?? null

  // Out-of-gas detected locally from gasUsed/gasLimit (no extra call), same as
  // the Moralis contract-tx path. Full revert decode happens on getTransactionByHash.
  let decodedRevert: DecodedRevert | undefined
  if (isFailed) {
    const used = parseInt(gasUsed, 10) || 0
    const lim = parseInt(gasLimit, 10) || 0
    const pct = lim > 0 ? Math.round((used / lim) * 100) : 0
    if (pct >= 99) {
      decodedRevert = {
        cause: "out_of_gas",
        reason: `Out of gas: ${used.toLocaleString()} of ${lim.toLocaleString()} units consumed (${pct}%).`,
        gasInfo: { used, limit: lim, percentUsed: pct },
      }
    }
  }
  const statusStr = (isFailed ? "failed" : "success") as "failed" | "success"
  // Blockscout returns `method` as the decoded name for verified contracts, but
  // the raw 4-byte selector (e.g. "0xae7e8d81") for unverified ones — don't
  // surface a bare selector as a human method name.
  const method = tx.method && !/^0x[0-9a-fA-F]{8}$/.test(tx.method) ? tx.method : undefined
  return {
    hash: tx.hash,
    blockNumber: String(tx.block_number ?? tx.block ?? ""),
    timestamp: tx.timestamp ?? "",
    from: tx.from?.hash ?? "",
    to,
    value: `${valueFmt} ${symbol}`,
    gasLimit,
    gasUsed,
    status: statusStr,
    summary: `Transaction ${statusStr}: ${valueFmt} ${symbol} to ${to ?? "contract creation"}`,
    ...(method ? { method } : {}),
    ...(decodedRevert ? { decodedRevert } : {}),
  }
}

export async function bsRecentTransactions(address: string, chainId: string, limit = 10): Promise<Transaction[]> {
  const data = await bsGet(chainId, `/addresses/${address}/transactions`) as { items?: BsTxItem[] } | null
  return (data?.items ?? []).slice(0, limit).map(tx => mapBsTx(tx, chainId))
}

export async function bsContractTransactions(contractAddress: string, chainId: string, limit = 10): Promise<Transaction[]> {
  const data = await bsGet(chainId, `/addresses/${contractAddress}/transactions?filter=to`) as { items?: BsTxItem[] } | null
  return (data?.items ?? [])
    .filter(tx => tx.to?.hash?.toLowerCase() === contractAddress.toLowerCase())
    .slice(0, limit)
    .map(tx => mapBsTx(tx, chainId))
}

// ── Single transaction (RPC — chain-agnostic, feeds the revert decoder) ──────

export async function bsTransactionByHash(
  hash: string,
  chainId: string,
  knownAbis: Record<string, string> = {},
): Promise<Transaction | null> {
  const tx = await rpcObj<{ blockNumber?: string; from?: string; to?: string | null; value?: string; gas?: string; input?: string }>(
    chainId, "eth_getTransactionByHash", [hash],
  )
  if (!tx?.from) return null
  const receipt = await rpcObj<{ status?: string; gasUsed?: string; blockNumber?: string }>(
    chainId, "eth_getTransactionReceipt", [hash],
  )
  const symbol = CHAIN_CONFIGS[chainId]?.nativeCurrency ?? "ETH"

  const toDec = (h?: string) => (h ? BigInt(h).toString() : "0")
  const blockNumber = toDec(tx.blockNumber)
  const gasLimit = toDec(tx.gas)
  const gasUsed = toDec(receipt?.gasUsed)
  const valueRaw = (() => { try { return BigInt(tx.value ?? "0x0") } catch { return 0n } })()
  const valueFmt = (Number(valueRaw) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })
  const isFailed = receipt?.status !== "0x1"
  const statusStr = (isFailed ? "failed" : "success") as "failed" | "success"

  // Block timestamp (ISO) from the block header.
  let timestamp = ""
  if (tx.blockNumber) {
    const block = await rpcObj<{ timestamp?: string }>(chainId, "eth_getBlockByNumber", [tx.blockNumber, false])
    if (block?.timestamp) timestamp = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString()
  }

  let decodedRevert: DecodedRevert | undefined
  if (isFailed && tx.to) {
    const abi = knownAbis[tx.to.toLowerCase()]
    decodedRevert = await decodeTxRevert({
      from: tx.from,
      to: tx.to,
      value: valueRaw.toString(),
      input: tx.input ?? "0x",
      blockNumber,
      gasUsed,
      gasLimit,
      chainId,
      ...(abi ? { preloadedAbi: abi } : {}),
    }).catch(() => undefined)
  }

  return {
    hash,
    blockNumber,
    timestamp,
    from: tx.from,
    to: tx.to ?? null,
    value: `${valueFmt} ${symbol}`,
    gasLimit,
    gasUsed,
    status: statusStr,
    summary: `Transaction ${statusStr}: ${valueFmt} ${symbol} to ${tx.to ?? "contract creation"}`,
    ...(decodedRevert ? { decodedRevert } : {}),
  }
}

// Blockscout has no clean per-wallet approvals endpoint — degrade gracefully.
export async function bsWalletApprovals(): Promise<WalletApproval[]> {
  return []
}

/** True when this chain should use the Blockscout adapter (no Moralis index). */
export function usesBlockscoutWallet(chainId: string): boolean {
  const c = CHAIN_CONFIGS[chainId]
  return !!c && !c.moralisChain && !!c.blockscoutApi
}
