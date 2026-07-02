import type { SolanaBalance, SolanaTokenBalance, SolanaTransaction } from "./types"

const HELIUS_RPC = "https://mainnet.helius-rpc.com"
const HELIUS_API = "https://api.helius.xyz/v0"

function apiKey(): string {
  const key = process.env.HELIUS_API_KEY
  if (!key) throw new Error("HELIUS_API_KEY is not set")
  return key
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const key = apiKey()
  const res = await fetch(`${HELIUS_RPC}/?api-key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`Helius RPC error: ${res.status}`)
  const data = (await res.json()) as { result?: unknown; error?: { message: string } }
  if (data.error) throw new Error(`Helius RPC: ${data.error.message}`)
  return data.result
}

/** SOL balance + SPL token balances for a wallet address */
export async function getSolanaWalletBalance(address: string): Promise<SolanaBalance> {
  const [balanceResult, tokenResult] = await Promise.all([
    rpc("getBalance", [address]),
    rpc("getTokenAccountsByOwner", [
      address,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]),
  ])

  const lamports = (balanceResult as { value: number }).value
  const sol = (lamports / 1e9).toLocaleString("en-US", { maximumFractionDigits: 6 })

  type TokenAccount = {
    account: {
      data: {
        parsed: {
          info: {
            mint: string
            tokenAmount: { amount: string; decimals: number; uiAmountString: string }
          }
        }
      }
    }
  }

  const accounts = ((tokenResult as { value: TokenAccount[] }).value ?? [])
    .filter(a => {
      const amt = a.account.data.parsed.info.tokenAmount
      return parseInt(amt.amount, 10) > 0
    })
    .slice(0, 30)

  const tokens: SolanaTokenBalance[] = accounts.map(a => {
    const info = a.account.data.parsed.info
    const ta = info.tokenAmount
    return {
      mint: info.mint,
      amount: ta.uiAmountString,
      amountRaw: ta.amount,
      decimals: ta.decimals,
    }
  })

  return { sol, solRaw: lamports, tokens }
}

// ── Helius Enhanced Transaction API ─────────────────────────────────────────

type HeliusEnrichedTx = {
  signature: string
  slot: number
  timestamp: number | null
  fee: number
  feePayer: string
  description: string | null
  type: string | null
  source: string | null
  nativeTransfers: Array<{ fromUserAccount: string; toUserAccount: string; amount: number }> | null
  tokenTransfers: Array<{
    mint: string
    fromTokenAccount: string
    toTokenAccount: string
    fromUserAccount: string | null
    toUserAccount: string | null
    tokenAmount: number
  }> | null
  accountData: Array<{ account: string; nativeBalanceChange: number }> | null
  transactionError: unknown | null
  instructions: Array<{ programId: string }> | null
}

function mapEnrichedTx(tx: HeliusEnrichedTx): SolanaTransaction {
  const programIds = [
    ...new Set((tx.instructions ?? []).map(i => i.programId)),
  ]

  let errorMsg: string | null = null
  if (tx.transactionError) {
    if (typeof tx.transactionError === "string") {
      errorMsg = tx.transactionError
    } else {
      errorMsg = JSON.stringify(tx.transactionError)
    }
  }

  return {
    signature: tx.signature,
    blockTime: tx.timestamp,
    slot: tx.slot,
    status: tx.transactionError ? "failed" : "success",
    fee: tx.fee,
    description: tx.description || null,
    type: tx.type || null,
    tokenTransfers: (tx.tokenTransfers ?? []).map(t => ({
      mint: t.mint,
      fromTokenAccount: t.fromTokenAccount,
      toTokenAccount: t.toTokenAccount,
      fromUserAccount: t.fromUserAccount,
      toUserAccount: t.toUserAccount,
      tokenAmount: t.tokenAmount,
    })),
    nativeTransfers: (tx.nativeTransfers ?? []).map(t => ({
      fromUserAccount: t.fromUserAccount,
      toUserAccount: t.toUserAccount,
      amount: t.amount,
    })),
    error: errorMsg,
    programIds,
  }
}

/** Recent transactions for a wallet, optionally filtered to a specific program */
export async function getSolanaRecentTransactions(
  address: string,
  programAddress?: string,
  limit = 10,
): Promise<SolanaTransaction[]> {
  const key = apiKey()
  const params = new URLSearchParams({
    "api-key": key,
    limit: String(Math.min(limit * 2, 40)),
  })
  if (programAddress) params.set("accountAddresses", programAddress)

  const res = await fetch(
    `${HELIUS_API}/addresses/${encodeURIComponent(address)}/transactions?${params}`,
    { signal: AbortSignal.timeout(10000) },
  )
  if (!res.ok) throw new Error(`Helius transactions error: ${res.status}`)
  const data = (await res.json()) as HeliusEnrichedTx[]

  let txs = data.map(mapEnrichedTx)

  // If filtering by program, keep only txs that involved that program
  if (programAddress) {
    txs = txs.filter(tx => tx.programIds.includes(programAddress))
  }

  return txs.slice(0, limit)
}

/** Full details for a single transaction by signature */
export async function getSolanaTransactionBySignature(
  signature: string,
): Promise<SolanaTransaction | null> {
  const key = apiKey()
  const res = await fetch(
    `${HELIUS_API}/transactions?api-key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactions: [signature] }),
      signal: AbortSignal.timeout(10000),
    },
  )
  if (!res.ok) return null
  const data = (await res.json()) as HeliusEnrichedTx[]
  const tx = data[0]
  if (!tx) return null
  return mapEnrichedTx(tx)
}
