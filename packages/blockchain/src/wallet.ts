import { CHAIN_CONFIGS } from "./types"
import type { TokenBalance, NativeBalance, Transaction, DecodedRevert } from "./types"
import { decodeTxRevert } from "./decoder"
import { functionSelector } from "./keccak"
import {
  usesBlockscoutWallet,
  bsNativeBalance,
  bsTokenBalances,
  bsRecentTransactions,
  bsContractTransactions,
  bsTransactionByHash,
  bsWalletApprovals,
} from "./blockscout-wallet"

/** Decode the called function name from a transaction's input selector using the ABI. */
function decodeMethodName(input: string, abiJson: string): string | undefined {
  try {
    if (!input || input.length < 10) return undefined
    const selector = input.slice(0, 10).toLowerCase()
    const abi = JSON.parse(abiJson) as Array<{ type: string; name?: string; inputs?: Array<{ type: string }> }>
    for (const f of abi) {
      if (f.type !== "function" || !f.name) continue
      const sig = `${f.name}(${(f.inputs ?? []).map(i => i.type).join(",")})`
      if (functionSelector(sig).toLowerCase() === selector) return f.name
    }
    return undefined
  } catch {
    return undefined
  }
}

const MORALIS_BASE = "https://deep-index.moralis.io/api/v2.2"

/**
 * The indexer's name for a chain, or null when we have none.
 *
 * NULL IS A REAL ANSWER, and it used to be "eth". A chain we do not recognise,
 * and a chain Moralis does not index (Etherlink has no `moralisChain`), both
 * land here. Defaulting to Ethereum meant asking the wrong chain and then
 * reporting its truthful "no such transaction" as a fact about the user's own
 * transaction. Every caller must now decide what to do without an indexer;
 * none of them may guess a chain.
 */
function moralisChain(chainId: string): string | null {
  return CHAIN_CONFIGS[chainId]?.moralisChain ?? null
}

function moralisHeaders(): Record<string, string> {
  const apiKey = process.env.MORALIS_API_KEY
  if (!apiKey) throw new Error("MORALIS_API_KEY is not set")
  return { "X-API-Key": apiKey, "Content-Type": "application/json" }
}

export interface WalletApproval {
  token: string
  symbol?: string
  spender: string
  spenderLabel?: string
  value: string
  valueFormatted?: string
  isUnlimited: boolean
}

/**
 * List the ERC-20 approvals a wallet has granted (token → spender → amount),
 * via Moralis' wallet approvals endpoint. Newest/riskiest first as returned.
 * Returns [] on any failure — never throws.
 */
export async function getWalletApprovals(
  address: string,
  chainId: string,
  limit = 25,
): Promise<WalletApproval[]> {
  if (usesBlockscoutWallet(chainId)) return bsWalletApprovals()
  try {
    const chain = moralisChain(chainId)
    if (!chain) return []
    const res = await fetch(
      `${MORALIS_BASE}/wallets/${address}/approvals?chain=${chain}`,
      { headers: moralisHeaders(), signal: AbortSignal.timeout(9000) },
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      result?: Array<{
        token?: { address?: string; symbol?: string }
        spender?: { address?: string; entity?: string; address_label?: string }
        value?: string
        value_formatted?: string
      }>
    }
    return (json.result ?? []).slice(0, limit).map(a => {
      const raw = a.value ?? "0"
      let isUnlimited = false
      try { isUnlimited = BigInt(raw) >= 1n << 255n } catch { /* keep false */ }
      const out: WalletApproval = {
        token: a.token?.address ?? "",
        spender: a.spender?.address ?? "",
        value: raw,
        isUnlimited,
      }
      if (a.token?.symbol) out.symbol = a.token.symbol
      const label = a.spender?.entity ?? a.spender?.address_label
      if (label) out.spenderLabel = label
      if (a.value_formatted) out.valueFormatted = a.value_formatted
      return out
    })
  } catch {
    return []
  }
}

/** Get native currency balance for a wallet on a given chain */
export async function getNativeBalance(
  address: string,
  chainId: string,
): Promise<NativeBalance> {
  if (usesBlockscoutWallet(chainId)) return bsNativeBalance(address, chainId)
  const chain = moralisChain(chainId)
  if (!chain) throw new Error(`No indexer configured for chain ${chainId}`)
  const res = await fetch(
    `${MORALIS_BASE}/${address}/balance?chain=${chain}`,
    { headers: moralisHeaders(), signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error(`Moralis balance error: ${res.status}`)
  const data = (await res.json()) as { balance: string }
  const raw = BigInt(data.balance)
  const formatted = (Number(raw) / 1e18).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  })
  const symbol = CHAIN_CONFIGS[chainId]?.nativeCurrency ?? "ETH"
  return { balance: data.balance, balanceFormatted: formatted, symbol }
}

/** Get ERC-20 token balances for a wallet */
export async function getTokenBalances(
  address: string,
  chainId: string,
): Promise<TokenBalance[]> {
  if (usesBlockscoutWallet(chainId)) return bsTokenBalances(address, chainId)
  const chain = moralisChain(chainId)
  if (!chain) throw new Error(`No indexer configured for chain ${chainId}`)
  const res = await fetch(
    `${MORALIS_BASE}/${address}/erc20?chain=${chain}`,
    { headers: moralisHeaders(), signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error(`Moralis token balances error: ${res.status}`)
  const data = (await res.json()) as Array<{
    token_address: string
    symbol: string
    name: string
    decimals: number
    balance: string
    usd_value: string | null
    logo: string | null
  }>
  return data.map((t) => {
    const raw = BigInt(t.balance)
    const divisor = BigInt(10 ** t.decimals)
    const whole = raw / divisor
    const frac = raw % divisor
    const formatted =
      frac === 0n
        ? whole.toLocaleString("en-US")
        : `${whole.toLocaleString("en-US")}.${frac.toString().padStart(t.decimals, "0").slice(0, 4).replace(/0+$/, "")}`
    return {
      tokenAddress: t.token_address,
      symbol: t.symbol,
      name: t.name,
      decimals: t.decimals,
      balance: t.balance,
      balanceFormatted: formatted,
      usdValue: t.usd_value ? `$${Number(t.usd_value).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : null,
      logo: t.logo,
    }
  })
}

/** The fields this module needs from a transaction, whatever the source. */
interface MoralisTx {
  hash: string
  block_number: string
  block_timestamp: string
  from_address: string
  to_address: string | null
  value: string
  gas: string
  input: string | null
  receipt_gas_used: string | null
  receipt_status: string | null
}

/**
 * The same transaction, read straight from the chain's own RPC.
 *
 * Deliberately a fallback rather than the default: this is three round trips
 * (transaction, receipt, block timestamp) where the indexer is one, and the
 * indexer also fills fields the RPC has no concept of. But an RPC that answers
 * beats an indexer that does not.
 */
async function rpcTransactionByHash(hash: string, chainId: string): Promise<MoralisTx | null> {
  const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
  if (!rpcUrl) return null

  const call = async (method: string, params: unknown[]): Promise<Record<string, string> | null> => {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) return null
      const json = (await res.json()) as { result?: Record<string, string> | null }
      return json.result ?? null
    } catch {
      return null
    }
  }

  const tx = await call("eth_getTransactionByHash", [hash])
  // A null result here IS the chain saying it has never seen this hash, which
  // is the one case where "not found" is a fact rather than a failure.
  if (!tx || !tx.blockNumber) return null

  const [receipt, block] = await Promise.all([
    call("eth_getTransactionReceipt", [hash]),
    call("eth_getBlockByNumber", [tx.blockNumber, false]),
  ])

  const dec = (hex: string | undefined) => (hex ? String(BigInt(hex)) : "0")
  return {
    hash: tx.hash ?? hash,
    block_number: dec(tx.blockNumber),
    block_timestamp: block?.timestamp
      ? new Date(Number(BigInt(block.timestamp)) * 1000).toISOString()
      : new Date().toISOString(),
    from_address: tx.from ?? "",
    to_address: tx.to ?? null,
    value: dec(tx.value),
    gas: dec(tx.gas),
    input: tx.input ?? "0x",
    receipt_gas_used: receipt?.gasUsed ? dec(receipt.gasUsed) : null,
    // Moralis reports "1"/"0"; the RPC reports 0x1/0x0. Normalise, and leave it
    // null when there is no receipt so a caller cannot read a missing receipt
    // as a failed transaction.
    receipt_status: receipt?.status === undefined ? null : receipt.status === "0x1" ? "1" : "0",
  }
}

/**
 * Get the full details of a single transaction by hash.
 * Pass knownAbis (address → ABI JSON) so the decoder can use a pre-stored ABI
 * instead of fetching from the block explorer at decode time.
 */
export async function getTransactionByHash(
  hash: string,
  chainId: string,
  knownAbis: Record<string, string> = {},
): Promise<Transaction | null> {
  if (usesBlockscoutWallet(chainId)) return bsTransactionByHash(hash, chainId, knownAbis)
  const chain = moralisChain(chainId)

  // The indexer is the preferred source because it returns the whole
  // transaction in one call. It is NOT the only source: when it is down, rate
  // limited or out of quota, the chain's own RPC still has the transaction,
  // and the alternative is telling a user their transaction does not exist.
  //
  // This was a real failure. Three successful PancakeSwap swaps, over an hour
  // old and plainly on BNB Chain, were reported to a user as "not found on BNB
  // Chain, most likely rejected in your wallet, no gas was spent". A provider
  // outage was rendered as a statement about the chain, which is the worst
  // answer this product can give: it tells someone nothing happened when their
  // money has already moved.
  let raw: MoralisTx | null = null
  try {
    // No indexer for this chain: the RPC below is the only honest source.
    if (!chain) throw new Error("no indexer for this chain")
    const res = await fetch(
      `${MORALIS_BASE}/transaction/${hash}?chain=${chain}`,
      { headers: moralisHeaders(), signal: AbortSignal.timeout(8000) },
    )
    // 404 is the indexer saying it has no such transaction, which is a real
    // answer but not a final one: it may simply not have indexed it yet. Every
    // other non-OK status is the indexer failing to answer at all.
    if (res.ok) raw = (await res.json()) as MoralisTx
  } catch {
    // Timeout or network failure: fall through to the chain itself.
  }

  if (!raw) raw = await rpcTransactionByHash(hash, chainId)
  if (!raw) return null
  const tx = raw as {
    hash: string
    block_number: string
    block_timestamp: string
    from_address: string
    to_address: string | null
    value: string
    gas: string
    input: string | null
    receipt_gas_used: string | null
    receipt_status: string | null
  }
  const valueEth = (Number(BigInt(tx.value ?? "0")) / 1e18).toLocaleString("en-US", {
    maximumFractionDigits: 6,
  })
  const symbol = CHAIN_CONFIGS[chainId]?.nativeCurrency ?? "ETH"
  const isFailed = tx.receipt_status !== "1"
  const statusStr = isFailed ? "failed" : "success"
  const gasUsed = tx.receipt_gas_used ?? "0"

  // For failed transactions, decode the revert reason in the background.
  // decodeTxRevert does an eth_call replay — gracefully returns "unknown" on any error.
  let decodedRevert: DecodedRevert | undefined
  if (isFailed && tx.to_address) {
    const abi = knownAbis[tx.to_address.toLowerCase()]
    decodedRevert = await decodeTxRevert({
      from: tx.from_address,
      to: tx.to_address,
      value: tx.value ?? "0",
      input: tx.input ?? "0x",
      blockNumber: tx.block_number,
      gasUsed,
      gasLimit: tx.gas,
      chainId,
      ...(abi ? { preloadedAbi: abi } : {}),
    }).catch(() => undefined)
  }

  // Decode which function the transaction called, when we have the ABI.
  let method: string | undefined
  if (tx.input && tx.input !== "0x" && tx.to_address) {
    const abi = knownAbis[tx.to_address.toLowerCase()]
    if (abi) method = decodeMethodName(tx.input, abi)
  }

  return {
    hash: tx.hash,
    blockNumber: tx.block_number,
    timestamp: tx.block_timestamp,
    from: tx.from_address,
    to: tx.to_address,
    value: `${valueEth} ${symbol}`,
    gasLimit: tx.gas,
    gasUsed,
    status: statusStr,
    summary: `Transaction ${statusStr}: ${valueEth} ${symbol} to ${tx.to_address ?? "contract creation"}`,
    ...(method ? { method } : {}),
    ...(decodedRevert ? { decodedRevert } : {}),
  }
}

/**
 * Get recent transactions sent TO a contract address.
 * Returns basic status info (no eth_call decode — follow up with getTransactionByHash
 * for full revert decoding on any failed tx found here).
 */
export async function getContractTransactions(
  contractAddress: string,
  chainId: string,
  limit = 10,
): Promise<Transaction[]> {
  if (usesBlockscoutWallet(chainId)) return bsContractTransactions(contractAddress, chainId, limit)
  const chain = moralisChain(chainId)
  if (!chain) throw new Error(`No indexer configured for chain ${chainId}`)
  // Fetch more than we need — Moralis returns both incoming and outgoing; we filter to incoming
  const res = await fetch(
    `${MORALIS_BASE}/${contractAddress}?chain=${chain}&limit=${Math.min(limit * 3, 60)}`,
    { headers: moralisHeaders(), signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error(`Moralis contract transactions error: ${res.status}`)
  const data = (await res.json()) as {
    result: Array<{
      hash: string
      block_number: string
      block_timestamp: string
      from_address: string
      to_address: string | null
      value: string
      gas: string
      receipt_gas_used: string
      receipt_status: string
    }>
  }

  const incoming = (data.result ?? [])
    .filter(tx => tx.to_address?.toLowerCase() === contractAddress.toLowerCase())
    .slice(0, limit)

  return incoming.map(tx => {
    const valueEth = (Number(BigInt(tx.value ?? "0")) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })
    const symbol = CHAIN_CONFIGS[chainId]?.nativeCurrency ?? "ETH"
    const isFailed = tx.receipt_status !== "1"

    // Detect out-of-gas locally (no RPC call)
    let decodedRevert: DecodedRevert | undefined
    if (isFailed) {
      const used = parseInt(tx.receipt_gas_used, 10) || 0
      const lim = parseInt(tx.gas, 10) || 0
      const pct = lim > 0 ? Math.round((used / lim) * 100) : 0
      if (pct >= 99) {
        decodedRevert = {
          cause: "out_of_gas" as const,
          reason: `Out of gas: ${used.toLocaleString()} of ${lim.toLocaleString()} units consumed (${pct}%).`,
          gasInfo: { used, limit: lim, percentUsed: pct },
        }
      }
    }

    return {
      hash: tx.hash,
      blockNumber: tx.block_number,
      timestamp: tx.block_timestamp,
      from: tx.from_address,
      to: tx.to_address,
      value: `${valueEth} ${symbol}`,
      gasLimit: tx.gas,
      gasUsed: tx.receipt_gas_used,
      status: (isFailed ? "failed" : "success") as "failed" | "success",
      summary: `${isFailed ? "Failed" : "Success"}: ${tx.from_address.slice(0, 6)}…${tx.from_address.slice(-4)} called contract`,
      ...(decodedRevert !== undefined ? { decodedRevert } : {}),
    }
  })
}

/** Get recent transactions for a wallet (last 10) */
export async function getRecentTransactions(
  address: string,
  chainId: string,
  limit = 10,
): Promise<Transaction[]> {
  if (usesBlockscoutWallet(chainId)) return bsRecentTransactions(address, chainId, limit)
  const chain = moralisChain(chainId)
  if (!chain) throw new Error(`No indexer configured for chain ${chainId}`)
  const res = await fetch(
    `${MORALIS_BASE}/${address}?chain=${chain}&limit=${limit}`,
    { headers: moralisHeaders(), signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error(`Moralis transactions error: ${res.status}`)
  const data = (await res.json()) as {
    result: Array<{
      hash: string
      block_number: string
      block_timestamp: string
      from_address: string
      to_address: string | null
      value: string
      gas: string
      receipt_gas_used: string
      receipt_status: string
    }>
  }
  return (data.result ?? []).map((tx) => {
    const valueEth = (Number(BigInt(tx.value)) / 1e18).toLocaleString("en-US", {
      maximumFractionDigits: 6,
    })
    const symbol = CHAIN_CONFIGS[chainId]?.nativeCurrency ?? "ETH"
    const isOut = tx.from_address.toLowerCase() === address.toLowerCase()
    const isFailed = tx.receipt_status !== "1"
    const summary = `${isOut ? "Sent" : "Received"} ${valueEth} ${symbol} ${isOut ? "to" : "from"} ${isOut ? (tx.to_address ?? "contract") : tx.from_address}`

    // Detect out-of-gas locally (no RPC call needed — just compare gas figures).
    // For other failure causes, call get_transaction_by_hash for a full decode.
    let decodedRevert: DecodedRevert | undefined
    if (isFailed) {
      const used = parseInt(tx.receipt_gas_used, 10) || 0
      const limit = parseInt(tx.gas, 10) || 0
      const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
      if (pct >= 99) {
        decodedRevert = {
          cause: "out_of_gas",
          reason: `Out of gas: ${used.toLocaleString()} of ${limit.toLocaleString()} units consumed (${pct}%).`,
          gasInfo: { used, limit, percentUsed: pct },
        }
      }
    }

    return {
      hash: tx.hash,
      blockNumber: tx.block_number,
      timestamp: tx.block_timestamp,
      from: tx.from_address,
      to: tx.to_address,
      value: `${valueEth} ${symbol}`,
      gasLimit: tx.gas,
      gasUsed: tx.receipt_gas_used,
      status: isFailed ? "failed" : "success",
      summary,
      ...(decodedRevert !== undefined ? { decodedRevert } : {}),
    }
  })
}
