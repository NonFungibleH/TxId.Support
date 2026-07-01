import { CHAIN_CONFIGS } from "./types"
import type { TokenBalance, NativeBalance, Transaction, DecodedRevert } from "./types"
import { decodeTxRevert } from "./decoder"

const MORALIS_BASE = "https://deep-index.moralis.io/api/v2.2"

function moralisChain(chainId: string): string {
  return CHAIN_CONFIGS[chainId]?.moralisChain ?? "eth"
}

function moralisHeaders(): Record<string, string> {
  const apiKey = process.env.MORALIS_API_KEY
  if (!apiKey) throw new Error("MORALIS_API_KEY is not set")
  return { "X-API-Key": apiKey, "Content-Type": "application/json" }
}

/** Get native currency balance for a wallet on a given chain */
export async function getNativeBalance(
  address: string,
  chainId: string,
): Promise<NativeBalance> {
  const chain = moralisChain(chainId)
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
  const chain = moralisChain(chainId)
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

/** Get the full details of a single transaction by hash */
export async function getTransactionByHash(
  hash: string,
  chainId: string,
): Promise<Transaction | null> {
  const chain = moralisChain(chainId)
  const res = await fetch(
    `${MORALIS_BASE}/transaction/${hash}?chain=${chain}`,
    { headers: moralisHeaders(), signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) return null
  const tx = (await res.json()) as {
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
    decodedRevert = await decodeTxRevert({
      from: tx.from_address,
      to: tx.to_address,
      value: tx.value ?? "0",
      input: tx.input ?? "0x",
      blockNumber: tx.block_number,
      gasUsed,
      gasLimit: tx.gas,
      chainId,
    }).catch(() => undefined)
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
    ...(decodedRevert ? { decodedRevert } : {}),
  }
}

/** Get recent transactions for a wallet (last 10) */
export async function getRecentTransactions(
  address: string,
  chainId: string,
  limit = 10,
): Promise<Transaction[]> {
  const chain = moralisChain(chainId)
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
