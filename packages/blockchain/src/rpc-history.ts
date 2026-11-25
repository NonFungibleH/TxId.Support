import { relativeAge } from "@txid/shared"
import { CHAIN_CONFIGS, nativeSymbol } from "./types"
import type { Transaction, DecodedRevert } from "./types"
import { LookupUnavailableError } from "./errors"
import { routedTargets } from "./arc"

/**
 * A wallet's SENT history, read from an archive node with no indexer at all.
 *
 * WHY THIS WORKS. An account's nonce after block B is the number of
 * transactions it had sent by then, failures included: a reverted transaction
 * still spends its nonce. So the block holding transaction number n is the
 * first block where the nonce reaches n + 1, and an archive node answers
 * `eth_getTransactionCount(address, block)` for any block. Searching for that
 * block finds the transaction, and the current nonce says exactly how many
 * exist. That last part is what an indexer usually cannot give: this history
 * KNOWS when it is complete.
 *
 * Cost, measured on Arc 2026-11-25: about 2.5 seconds per transaction with a
 * plain binary search. This uses an 8-way search, one batched request per
 * round, so each transaction costs about nine round trips.
 *
 * What it cannot see: transactions RECEIVED (they do not touch the sender's
 * nonce) and operations sent through a smart account, whose nonce lives in the
 * EntryPoint. Callers say "sent by this wallet", never "all activity".
 */

interface RpcCall { method: string; params: unknown[] }

async function batch(rpcUrl: string, calls: RpcCall[], chainId: string): Promise<unknown[]> {
  let res: Response
  try {
    res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, method: c.method, params: c.params }))),
      signal: AbortSignal.timeout(15000),
    })
  } catch (e) {
    throw new LookupUnavailableError(chainId, `the ${CHAIN_CONFIGS[chainId]?.name ?? chainId} node did not answer: ${e instanceof Error ? e.message : "network error"}`)
  }
  if (!res.ok) throw new LookupUnavailableError(chainId, `the ${CHAIN_CONFIGS[chainId]?.name ?? chainId} node answered ${res.status}`)
  const body = (await res.json().catch(() => null)) as { id: number; result?: unknown; error?: unknown }[] | null
  if (!Array.isArray(body)) throw new LookupUnavailableError(chainId, "the node returned something other than a batch response")
  const out = new Array<unknown>(calls.length)
  for (const r of body) {
    // A node that declines one call has not answered it. A missing nonce is not
    // nonce zero, so any error fails the whole read rather than guessing.
    if (r.error !== undefined || r.result === undefined) {
      throw new LookupUnavailableError(chainId, "the node declined part of the history read (it may not keep archive state)")
    }
    out[r.id] = r.result
  }
  if (out.some(v => v === undefined)) throw new LookupUnavailableError(chainId, "the node returned an incomplete batch")
  return out
}

const hex = (n: number) => "0x" + n.toString(16)
const num = (h: unknown) => (typeof h === "string" ? Number(BigInt(h)) : NaN)

/**
 * Nonces at several blocks in one round trip. Arc's node answers up to eight
 * archive reads spanning its whole history in one batch and rejects every call
 * in a batch of sixteen (measured 2026-11-25), so the batch starts at eight and
 * halves on refusal, down to one call at a time, before giving up.
 */
async function noncesAt(rpcUrl: string, chainId: string, address: string, blocks: number[]): Promise<number[]> {
  const out: number[] = []
  let size = Math.min(8, blocks.length)
  let strikes = 0
  for (let i = 0; i < blocks.length;) {
    const chunk = blocks.slice(i, i + size)
    try {
      out.push(...(await batch(rpcUrl, chunk.map(b => ({ method: "eth_getTransactionCount", params: [address, hex(b)] })), chainId)).map(num))
      i += chunk.length
      strikes = 0
    } catch (e) {
      // Under load the public node answers "internal error" for a while. Back
      // off and shrink the batch; give up only after three refusals in a row
      // at a single call, which is the node really not answering.
      strikes++
      if (size === 1 && strikes > 3) throw e
      size = Math.max(1, Math.floor(size / 2))
      await new Promise(r => setTimeout(r, BACKOFF_MS * strikes))
    }
  }
  return out
}

/** Pause between retries. Zero under test, so a refusal does not slow the suite. */
const BACKOFF_MS = process.env.VITEST ? 0 : 300

/** The first block in [lo, hi] at which the nonce has reached `target`. */
async function firstBlockAtNonce(
  rpcUrl: string, chainId: string, address: string, target: number, lo: number, hi: number,
): Promise<number> {
  const WAYS = 8
  // Recent transactions are the ones people ask about, so look backwards from
  // the top first, at exponentially growing distances, to bracket the answer
  // before splitting the range. A transaction minutes old resolves in about
  // four round trips instead of nine.
  const gallop = [1, 8, 64, 512, 4096, 32_768, 262_144, 2_097_152].map(d => hi - d).filter(b => b > lo)
  if (gallop.length > 0) {
    const ns = await noncesAt(rpcUrl, chainId, address, gallop)
    const below = ns.findIndex(n => n < target)
    if (below === -1) hi = gallop[gallop.length - 1]!
    else {
      lo = gallop[below]! + 1
      if (below > 0) hi = gallop[below - 1]!
    }
  }
  while (lo < hi) {
    const span = hi - lo
    const step = Math.max(1, Math.ceil(span / WAYS))
    const points: number[] = []
    for (let b = lo; b < hi; b += step) points.push(b)
    const nonces = await noncesAt(rpcUrl, chainId, address, points)
    if (nonces.some(n => !Number.isFinite(n))) throw new LookupUnavailableError(chainId, "the node returned a malformed nonce")
    const i = nonces.findIndex(n => n >= target)
    if (i === -1) { lo = points[points.length - 1]! + 1; continue }
    if (i === 0) { hi = points[0]!; break }
    lo = points[i - 1]! + 1
    hi = points[i]!
  }
  return hi
}

interface RpcBlock { number: string; timestamp: string; transactions: RpcTx[] }
interface RpcTx { hash: string; from: string; to: string | null; nonce: string; value: string; gas: string; input: string; blockNumber: string }
interface RpcReceipt { status: string; gasUsed: string }

function toTransaction(tx: RpcTx, receipt: RpcReceipt, block: RpcBlock, chainId: string): Transaction {
  const symbol = nativeSymbol(chainId)
  const value = (Number(BigInt(tx.value ?? "0x0")) / 1e18).toLocaleString("en-US", { maximumFractionDigits: 6 })
  const failed = receipt.status !== "0x1"
  const gasUsed = String(BigInt(receipt.gasUsed ?? "0x0"))
  const gasLimit = String(BigInt(tx.gas ?? "0x0"))
  const timestamp = new Date(Number(BigInt(block.timestamp)) * 1000).toISOString()
  let decodedRevert: DecodedRevert | undefined
  if (failed) {
    const used = Number(gasUsed), limit = Number(gasLimit)
    const pct = limit > 0 ? Math.round((used / limit) * 100) : 0
    if (pct >= 99) {
      decodedRevert = {
        cause: "out_of_gas",
        reason: `Out of gas: ${used.toLocaleString()} of ${limit.toLocaleString()} units consumed (${pct}%).`,
        gasInfo: { used, limit, percentUsed: pct },
      }
    }
  }
  const status = failed ? "failed" as const : "success" as const
  const targets = routedTargets(tx.to, tx.input)
  const routed = targets.length > 0 && !(targets.length === 1 && targets[0]!.toLowerCase() === tx.to?.toLowerCase())
  return {
    hash: tx.hash,
    blockNumber: String(BigInt(block.number)),
    timestamp,
    age: relativeAge(timestamp),
    from: tx.from,
    to: tx.to,
    value: `${value} ${symbol}`,
    gasLimit,
    gasUsed,
    status,
    summary: `Transaction ${status}: ${value} ${symbol} to ${tx.to ?? "contract creation"}`,
    ...(decodedRevert ? { decodedRevert } : {}),
    ...(routed ? { targets } : {}),
  }
}

export interface SentHistory {
  /** Every transaction this wallet has ever sent: the nonce, which is exact. */
  sent: number
  /** The most recent ones, newest first. */
  txs: Transaction[]
}

export async function rpcSentHistory(address: string, chainId: string, limit: number): Promise<SentHistory> {
  const cfg = CHAIN_CONFIGS[chainId]
  if (!cfg?.rpcUrl || !cfg.rpcHistory) throw new LookupUnavailableError(chainId, `no archive history route is configured for chain ${chainId}`)
  const rpcUrl = cfg.rpcUrl

  const [latestRaw] = await batch(rpcUrl, [{ method: "eth_blockNumber", params: [] }], chainId)
  const latest = num(latestRaw)
  if (!Number.isFinite(latest)) throw new LookupUnavailableError(chainId, "the node returned a malformed block number")
  // Pinned to one block so a wallet sending while we read cannot shift the count.
  const [nonceRaw] = await batch(rpcUrl, [{ method: "eth_getTransactionCount", params: [address, hex(latest)] }], chainId)
  const sent = num(nonceRaw)
  if (!Number.isFinite(sent)) throw new LookupUnavailableError(chainId, "the node returned a malformed nonce")

  const txs: Transaction[] = []
  let hi = latest
  for (let n = sent; n > 0 && txs.length < limit; n--) {
    const block = await firstBlockAtNonce(rpcUrl, chainId, address, n, 1, hi)
    const [blockRaw] = await batch(rpcUrl, [{ method: "eth_getBlockByNumber", params: [hex(block), true] }], chainId)
    const b = blockRaw as RpcBlock | null
    const tx = b?.transactions?.find(t => t.from?.toLowerCase() === address.toLowerCase() && num(t.nonce) === n - 1)
    // The nonce moved in this block but no transaction from this wallet is in
    // it (an EIP-7702 delegation, say). Stop rather than skip silently: what
    // has been read so far is still true, and the caller sees fewer than
    // `sent`, so it is never mistaken for the whole history.
    if (!b || !tx) break
    const [receiptRaw] = await batch(rpcUrl, [{ method: "eth_getTransactionReceipt", params: [tx.hash] }], chainId)
    if (!receiptRaw) break
    txs.push(toTransaction(tx, receiptRaw as RpcReceipt, b, chainId))
    hi = block
  }
  return { sent, txs }
}
