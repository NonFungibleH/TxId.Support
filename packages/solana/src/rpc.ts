import { relativeAgeFromEpoch } from "@txid/shared"
import { decodeSolanaError } from "./errors"
import { SolanaLookupUnavailableError } from "./lookup"
import type {
  SolanaBalance,
  SolanaNativeTransfer,
  SolanaTokenBalance,
  SolanaTokenTransfer,
  SolanaTransaction,
} from "./types"

/**
 * Solana over PLAIN JSON-RPC, with no key and no Helius.
 *
 * Solana was the last paused chain, and it was paused on a credential rather
 * than on anything technical: every read `helius.ts` performs has a standard
 * JSON-RPC equivalent that any mainnet node answers. `getBalance` and
 * `getTokenAccountsByOwner` are standard methods Helius merely proxies, and
 * history is `getSignaturesForAddress` + `getTransaction`.
 *
 * WHAT THIS PATH GIVES UP, AND IT MUST NOT BE PAPERED OVER: Helius's enriched
 * API returns a human `description` ("Swapped 1 SOL for 20 USDC") and a `type`
 * ("SWAP"). Those are Helius's own interpretation and no node produces them, so
 * here they are NULL. Writing a description from the instruction list would be
 * inventing the one field the user is most likely to quote back.
 *
 * WHAT IT GAINS, which is not nothing: raw `getTransaction` carries
 * `meta.logMessages`, and an Anchor program prints its own error name and
 * number there. That is the AUTHORITATIVE branch of `decodeSolanaError`'s
 * ladder, and the enriched path does not carry logs at all. So a failure read
 * this way is decoded at least as well, and sometimes better.
 */

const DEFAULT_ENDPOINTS = ["https://api.mainnet-beta.solana.com"]

/** `SOLANA_RPC_URLS`, JSON array or comma-separated. Falls back to the public node. */
function endpoints(): string[] {
  const raw = process.env.SOLANA_RPC_URLS?.trim()
  if (!raw) return DEFAULT_ENDPOINTS
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const urls = parsed.filter((u): u is string => typeof u === "string" && u.startsWith("http"))
      if (urls.length) return urls
    }
  } catch {
    // Not JSON, fall through to the comma-separated form.
  }
  const urls = raw.split(",").map(s => s.trim()).filter(u => u.startsWith("http"))
  return urls.length ? urls : DEFAULT_ENDPOINTS
}

interface RpcOk<T> { kind: "ok"; value: T; endpoint: string }
interface RpcUnavailable { kind: "unavailable"; reason: string }
type RpcResult<T> = RpcOk<T> | RpcUnavailable

/**
 * One JSON-RPC call, tried across the configured endpoints.
 *
 * A JSON-RPC `error` object is a node DECLINING to answer, so it is
 * `unavailable` and never an empty result. This is the same rule the EVM side
 * learned in #68 and the Aptos side in `aptosRead`.
 */
async function call<T>(method: string, params: unknown[], timeoutMs = 10000): Promise<RpcResult<T>> {
  let lastReason = "no Solana endpoint is configured"
  for (const url of endpoints()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) { lastReason = `a Solana node returned ${res.status}`; continue }
      let body: { result?: T; error?: { message?: string } }
      try {
        body = (await res.json()) as typeof body
      } catch {
        lastReason = "a Solana node returned unreadable JSON"
        continue
      }
      if (body.error) { lastReason = `a Solana node declined the request: ${body.error.message ?? "no reason given"}`; continue }
      if (body.result === undefined || body.result === null) { lastReason = "a Solana node returned no result"; continue }
      return { kind: "ok", value: body.result, endpoint: url }
    } catch (e) {
      lastReason = e instanceof Error && e.name === "TimeoutError"
        ? "a Solana node did not respond in time"
        : "a Solana node could not be reached"
    }
  }
  return { kind: "unavailable", reason: lastReason }
}

function unwrap<T>(r: RpcResult<T>): T {
  if (r.kind === "unavailable") throw new SolanaLookupUnavailableError(r.reason)
  return r.value
}

// ── Ledger retention, which decides whether an empty list is an ANSWER ───────

/**
 * How far back a node's ledger goes, cached per endpoint for the process.
 *
 * THIS IS THE LOAD-BEARING PART OF THE FILE, and it was found by measurement
 * rather than reasoning. `solana-rpc.publicnode.com` returns an EMPTY
 * signature list, HTTP 200, no error, for a wallet whose last activity was 25
 * days ago, because it retains roughly three days of ledger
 * (`getFirstAvailableBlock` 444,703,101 against a current slot of 445,356,904,
 * measured 2026-09-08). `api.mainnet-beta.solana.com` returns that wallet's
 * five real signatures.
 *
 * So on a pruning node, "this wallet has no transactions" and "my ledger does
 * not go back that far" are THE SAME RESPONSE. That is the absence-is-not-a-
 * finding bug arriving from upstream, where no amount of care in our own code
 * would catch it, and the user it hits is precisely the one who came back after
 * a month to ask what happened to their money.
 *
 * An archival node reports 0. Anything else prunes, and an empty result from a
 * pruning node is `unavailable`, never a finding.
 */
/**
 * Cached per endpoint, and it caches the FACT rather than the block number.
 * A node's first available block moves forward constantly, so a cached number
 * is stale the moment it is stored and invites a future reader to use it for
 * something it cannot support. Whether the node is archival does not change.
 */
const archivalCache = new Map<string, boolean>()

/** True when the node keeps full history, so an empty list is a real answer. */
async function isArchival(endpoint: string): Promise<boolean> {
  const cached = archivalCache.get(endpoint)
  if (cached !== undefined) return cached
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getFirstAvailableBlock", params: [] }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return false
    const body = (await res.json()) as { result?: number }
    if (typeof body.result !== "number") return false
    const archival = body.result === 0
    if (archivalCache.size > 20) archivalCache.clear()
    archivalCache.set(endpoint, archival)
    return archival
  } catch {
    // Could not establish retention, so an empty list cannot be trusted as an
    // answer. Failing closed here is the whole point of the guard.
    return false
  }
}

/**
 * Retention as an ANSWER rather than a gate.
 *
 * `isArchival` is deliberately two-valued and fails closed, because for the
 * guard "this node prunes" and "this node did not reply" are the same fact: an
 * empty list is not an answer. For an operator they are opposite problems. One
 * is a plan that does not include archival history; the other is a URL, a key
 * or a quota. Collapsing them sends someone to fix the wrong thing.
 *
 * So this returns the three states the caller can actually act on, and it does
 * NOT use the archival cache: the cache stores a boolean and the whole point
 * here is the case that boolean loses.
 */
export type SolanaRetention =
  | { kind: "archival"; endpoint: string }
  | { kind: "pruning"; endpoint: string; firstAvailableBlock: number }
  | { kind: "unavailable"; endpoint: string; reason: string }

export async function solanaRetention(): Promise<SolanaRetention> {
  const endpoint = endpoints()[0] ?? DEFAULT_ENDPOINTS[0]!
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getFirstAvailableBlock", params: [] }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      return { kind: "unavailable", endpoint, reason: `node replied HTTP ${res.status}` }
    }
    const body = (await res.json()) as { result?: unknown; error?: { message?: string } }
    if (body.error) {
      return { kind: "unavailable", endpoint, reason: body.error.message ?? "node declined the request" }
    }
    if (typeof body.result !== "number") {
      // A node that answers something other than a number is not reporting a
      // shallow ledger, it is not answering the question asked.
      return { kind: "unavailable", endpoint, reason: "node did not return a block number" }
    }
    return body.result === 0
      ? { kind: "archival", endpoint }
      : { kind: "pruning", endpoint, firstAvailableBlock: body.result }
  } catch (err) {
    return {
      kind: "unavailable",
      endpoint,
      reason: err instanceof Error ? err.message : "could not reach the node",
    }
  }
}

// ── Balances ────────────────────────────────────────────────────────────────

const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"

interface ParsedTokenAccount {
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

export async function getSolanaWalletBalanceRpc(address: string): Promise<SolanaBalance> {
  // Token-2022 is a SEPARATE program, so a wallet holding only Token-2022 mints
  // looks empty when you ask the original program alone. Both are requested;
  // if the second is unavailable the result would be a PARTIAL holdings list
  // presented as complete, so the whole read fails rather than under-report.
  const [balance, legacy, token22] = await Promise.all([
    call<{ value: number }>("getBalance", [address]),
    call<{ value: ParsedTokenAccount[] }>("getTokenAccountsByOwner", [
      address, { programId: TOKEN_PROGRAM }, { encoding: "jsonParsed" },
    ]),
    call<{ value: ParsedTokenAccount[] }>("getTokenAccountsByOwner", [
      address, { programId: TOKEN_2022_PROGRAM }, { encoding: "jsonParsed" },
    ]),
  ])

  const lamports = unwrap(balance).value
  if (typeof lamports !== "number") throw new SolanaLookupUnavailableError("a Solana node returned a balance that was not a number")
  const sol = (lamports / 1e9).toLocaleString("en-US", { maximumFractionDigits: 6 })

  const accounts = [...unwrap(legacy).value ?? [], ...unwrap(token22).value ?? []]
  const tokens: SolanaTokenBalance[] = accounts
    .filter(a => {
      const amt = a?.account?.data?.parsed?.info?.tokenAmount
      return amt ? parseInt(amt.amount, 10) > 0 : false
    })
    .slice(0, 30)
    .map(a => {
      const info = a.account.data.parsed.info
      return {
        mint: info.mint,
        amount: info.tokenAmount.uiAmountString,
        amountRaw: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
      }
    })

  return { sol, solRaw: lamports, tokens }
}

// ── Transactions ────────────────────────────────────────────────────────────

interface RawTx {
  slot: number
  blockTime: number | null
  meta: {
    err: unknown | null
    fee: number
    logMessages?: string[] | null
    preBalances?: number[] | null
    postBalances?: number[] | null
    preTokenBalances?: RawTokenBalance[] | null
    postTokenBalances?: RawTokenBalance[] | null
    innerInstructions?: Array<{ instructions: Array<{ programId?: string }> }> | null
  } | null
  transaction: {
    signatures: string[]
    message: {
      accountKeys: Array<string | { pubkey: string }>
      instructions: Array<{ programId?: string }>
    }
  }
}

interface RawTokenBalance {
  accountIndex: number
  mint: string
  owner?: string
  uiTokenAmount: { amount: string; decimals: number; uiAmount: number | null }
}

const keyAt = (keys: RawTx["transaction"]["message"]["accountKeys"], i: number): string => {
  const k = keys[i]
  return typeof k === "string" ? k : (k?.pubkey ?? "")
}

/**
 * Native transfers, derived from the balance deltas the node reports.
 *
 * `preBalances`/`postBalances` are the only native movement a raw transaction
 * exposes, and they are a NET per account rather than a list of transfers. The
 * fee payer's delta includes the fee, which is not a transfer, so it is added
 * back before deciding whether anything actually moved. Accounts whose net is
 * zero are omitted rather than rendered as a zero transfer.
 */
function nativeTransfers(tx: RawTx): SolanaNativeTransfer[] {
  const pre = tx.meta?.preBalances
  const post = tx.meta?.postBalances
  if (!pre || !post || pre.length !== post.length) return []
  const keys = tx.transaction.message.accountKeys
  const fee = tx.meta?.fee ?? 0

  const senders: Array<{ who: string; amount: number }> = []
  const receivers: Array<{ who: string; amount: number }> = []
  for (let i = 0; i < pre.length; i++) {
    let delta = (post[i] ?? 0) - (pre[i] ?? 0)
    if (i === 0) delta += fee
    if (delta > 0) receivers.push({ who: keyAt(keys, i), amount: delta })
    else if (delta < 0) senders.push({ who: keyAt(keys, i), amount: -delta })
  }
  // Deltas do not say WHO paid WHOM when several accounts move at once. The
  // unambiguous case is one sender, and only that is reported as a transfer
  // with a counterparty; anything else would be a guess at a payment graph.
  if (senders.length !== 1) return []
  const from = senders[0]
  if (!from) return []
  return receivers.map(r => ({ fromUserAccount: from.who, toUserAccount: r.who, amount: r.amount }))
}

/** Token movement, from the per-account before/after the node reports. */
function tokenTransfers(tx: RawTx): SolanaTokenTransfer[] {
  const pre = tx.meta?.preTokenBalances ?? []
  const post = tx.meta?.postTokenBalances ?? []
  if (!pre.length && !post.length) return []
  const keys = tx.transaction.message.accountKeys

  const byIndex = new Map<number, { mint: string; owner: string | null; before: bigint; after: bigint; decimals: number }>()
  for (const b of pre) {
    byIndex.set(b.accountIndex, {
      mint: b.mint, owner: b.owner ?? null, decimals: b.uiTokenAmount.decimals,
      before: BigInt(b.uiTokenAmount.amount || "0"), after: 0n,
    })
  }
  for (const b of post) {
    const cur = byIndex.get(b.accountIndex)
    if (cur) cur.after = BigInt(b.uiTokenAmount.amount || "0")
    else byIndex.set(b.accountIndex, {
      mint: b.mint, owner: b.owner ?? null, decimals: b.uiTokenAmount.decimals,
      before: 0n, after: BigInt(b.uiTokenAmount.amount || "0"),
    })
  }

  const out: SolanaTokenTransfer[] = []
  for (const [mint] of new Map([...byIndex.values()].map(v => [v.mint, true]))) {
    const legs = [...byIndex.entries()].filter(([, v]) => v.mint === mint)
    const senders = legs.filter(([, v]) => v.after < v.before)
    const receivers = legs.filter(([, v]) => v.after > v.before)
    if (senders.length !== 1) continue
    const senderEntry = senders[0]
    if (!senderEntry) continue
    const [sIdx, s] = senderEntry
    for (const [rIdx, r] of receivers) {
      const raw = r.after - r.before
      out.push({
        mint,
        fromTokenAccount: keyAt(keys, sIdx),
        toTokenAccount: keyAt(keys, rIdx),
        fromUserAccount: s.owner,
        toUserAccount: r.owner,
        tokenAmount: Number(raw) / 10 ** r.decimals,
      })
    }
  }
  return out
}

function programIdsOf(tx: RawTx): string[] {
  const top = tx.transaction.message.instructions.map(i => i.programId).filter((p): p is string => !!p)
  const inner = (tx.meta?.innerInstructions ?? []).flatMap(g =>
    g.instructions.map(i => i.programId).filter((p): p is string => !!p))
  return [...new Set([...top, ...inner])]
}

function mapRawTx(tx: RawTx): SolanaTransaction {
  const err = tx.meta?.err ?? null
  // The ORDERED top-level list, not the deduped one: `InstructionError` carries
  // an INDEX into it, so deduping first would point the blame at the wrong
  // program. A ComputeBudget instruction at index 0 is exactly how that
  // off-by-one happens on a real transaction.
  const orderedPrograms = tx.transaction.message.instructions
    .map(i => i.programId ?? "")

  const decoded = err
    ? decodeSolanaError(err, {
        programIds: orderedPrograms,
        logs: tx.meta?.logMessages ?? [],
      })
    : undefined

  return {
    signature: tx.transaction.signatures[0] ?? "",
    blockTime: tx.blockTime,
    // Solana's blockTime is SECONDS. Passing it as milliseconds renders 1970.
    age: relativeAgeFromEpoch(tx.blockTime ?? null, "s"),
    slot: tx.slot,
    status: err ? "failed" : "success",
    fee: tx.meta?.fee ?? 0,
    // NOT DERIVABLE from a raw transaction. Helius writes these itself, and
    // guessing a description is inventing the field a user quotes back.
    description: null,
    type: null,
    tokenTransfers: tokenTransfers(tx),
    nativeTransfers: nativeTransfers(tx),
    error: err ? (typeof err === "string" ? err : JSON.stringify(err)) : null,
    ...(decoded ? { decodedError: decoded } : {}),
    programIds: programIdsOf(tx),
  }
}

const TX_CONFIG = { maxSupportedTransactionVersion: 0, encoding: "jsonParsed" as const }

export async function getSolanaTransactionBySignatureRpc(signature: string): Promise<SolanaTransaction | null> {
  const r = await call<RawTx | null>("getTransaction", [signature, TX_CONFIG])
  if (r.kind === "unavailable") throw new SolanaLookupUnavailableError(r.reason)
  // `call` already treats a null result as no-result, so reaching here means a
  // node answered with a transaction. A genuine miss comes back as a null
  // result from every endpoint, which is `unavailable` above rather than
  // `not found`: an archival node is needed before "no such signature" is a
  // claim we can make, and it is checked below.
  return mapRawTx(r.value as RawTx)
}

/**
 * A signature that no node returned.
 *
 * Separated out because "not on chain" is a FINDING and only an archival node
 * can support it. A pruning node that has never heard of a month-old signature
 * is not evidence the transaction does not exist.
 */
export async function solanaSignatureAbsent(signature: string): Promise<boolean> {
  const r = await call<RawTx | null>("getTransaction", [signature, TX_CONFIG])
  if (r.kind === "ok") return false
  for (const url of endpoints()) {
    if (await isArchival(url)) return true
  }
  throw new SolanaLookupUnavailableError(
    "no archival Solana node was reachable, so we cannot tell a transaction that does not exist from one this node no longer keeps",
  )
}

export async function getSolanaRecentTransactionsRpc(
  address: string,
  programAddress?: string,
  limit = 10,
): Promise<SolanaTransaction[]> {
  const sigs = await call<Array<{ signature: string }>>("getSignaturesForAddress", [
    address, { limit: Math.min(limit * 2, 40) },
  ])
  if (sigs.kind === "unavailable") throw new SolanaLookupUnavailableError(sigs.reason)

  const list = Array.isArray(sigs.value) ? sigs.value : []
  if (list.length === 0) {
    // THE MEASURED CASE. An empty list from a pruning node means "not in the
    // part of the ledger I keep", which is not "this wallet has no history".
    if (!(await isArchival(sigs.endpoint))) {
      throw new SolanaLookupUnavailableError(
        "the Solana node reached keeps only recent history, so an empty result cannot be reported as no transactions",
      )
    }
    return []
  }

  // Sequential rather than parallel: the public endpoint rate-limits hard, and
  // a 429 mid-batch would silently shorten the list, which is the same bug in
  // a different costume (see hydrateVersions on Aptos).
  const out: SolanaTransaction[] = []
  let unread = 0
  for (const s of list) {
    if (out.length >= limit) break
    const r = await call<RawTx | null>("getTransaction", [s.signature, TX_CONFIG])
    if (r.kind === "unavailable") { unread++; continue }
    const tx = mapRawTx(r.value as RawTx)
    if (programAddress && !tx.programIds.includes(programAddress)) continue
    out.push(tx)
  }

  // A partial read presented as a complete history is the quiet form of the
  // same bug. If nothing at all could be hydrated, say so rather than hand back
  // an empty list that reads as an inactive wallet.
  if (out.length === 0 && unread > 0) {
    throw new SolanaLookupUnavailableError(
      `the Solana node returned ${list.length} signatures but no transaction details`,
    )
  }
  return out
}

/** True when no Helius key is configured, so the keyless path is the one in use. */
export function usingKeylessSolana(): boolean {
  return !process.env.HELIUS_API_KEY
}
