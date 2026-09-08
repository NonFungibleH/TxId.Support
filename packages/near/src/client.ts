import { relativeAgeFromEpoch } from "@txid/shared"
import { decodeNearError } from "./errors"
import { NearLookupUnavailableError } from "./lookup"
import { nearRpc } from "./rpc"
import type { NearTransaction } from "./types"

interface TxOutcome {
  transaction: { hash: string; signer_id: string; receiver_id: string; actions?: unknown[] }
  transaction_outcome?: { block_hash?: string; outcome?: { gas_burnt?: number; tokens_burnt?: string } }
  receipts_outcome?: Array<{ outcome?: { gas_burnt?: number; tokens_burnt?: string; executor_id?: string } }>
  status?: Record<string, unknown>
}

/** The method names a transaction declared, in order. */
function methodsOf(actions: unknown[] | undefined): string[] {
  if (!Array.isArray(actions)) return []
  const out: string[] = []
  for (const a of actions) {
    if (a && typeof a === "object" && "FunctionCall" in a) {
      const fc = (a as { FunctionCall?: { method_name?: string } }).FunctionCall
      if (typeof fc?.method_name === "string") out.push(fc.method_name)
    } else if (typeof a === "string") {
      out.push(a)
    } else if (a && typeof a === "object") {
      const k = Object.keys(a)[0]
      if (k) out.push(k)
    }
  }
  return out
}

/**
 * A single NEAR transaction, decoded.
 *
 * `EXPERIMENTAL_tx_status` takes a hash AND a signer account. Measured
 * 2026-09-08: the signer is not actually enforced, and a deliberately wrong one
 * still returned the right transaction. It is still passed correctly when known,
 * because relying on an unenforced parameter staying unenforced is how a lookup
 * breaks silently later.
 *
 * `senderHint` is optional precisely because a user pasting a hash into the
 * widget does not know it. NEAR's own docs require it; reality does not.
 */
export async function getNearTransaction(
  hash: string,
  senderHint?: string,
): Promise<NearTransaction | null> {
  const r = await nearRpc<TxOutcome>("EXPERIMENTAL_tx_status", [hash, senderHint || "txid.near"])
  if (r.kind === "unavailable") throw new NearLookupUnavailableError(r.reason)
  // A definite miss from an archival node. `rpc.ts` has already refused to call
  // a pruning node's miss a finding, so reaching here means we can say it.
  if (r.kind === "missing") return null

  const v = r.value
  const status = v.status ?? {}
  const failed = "Failure" in status
  const receiverId = v.transaction.receiver_id

  // Gas and cost are per RECEIPT, not per transaction. NEAR fans a call out
  // across receipts, so the transaction-level figure alone understates what the
  // user actually paid, sometimes by a lot.
  const outcomes = [
    ...(v.transaction_outcome?.outcome ? [v.transaction_outcome.outcome] : []),
    ...(v.receipts_outcome ?? []).map(o => o.outcome).filter(Boolean),
  ] as Array<{ gas_burnt?: number; tokens_burnt?: string }>
  let gas = 0n
  let burnt = 0n
  for (const o of outcomes) {
    if (typeof o.gas_burnt === "number") gas += BigInt(o.gas_burnt)
    if (typeof o.tokens_burnt === "string" && /^\d+$/.test(o.tokens_burnt)) burnt += BigInt(o.tokens_burnt)
  }

  const block = await blockOf(v.transaction_outcome?.block_hash)

  return {
    hash: v.transaction.hash,
    signerId: v.transaction.signer_id,
    receiverId,
    status: failed ? "failed" : "success",
    blockHeight: block?.height ?? null,
    timestamp: block?.iso ?? null,
    // NEAR block timestamps are NANOseconds. Passing them as anything else
    // renders a date tens of thousands of years out.
    age: block?.ms != null ? relativeAgeFromEpoch(Math.floor(block.ms), "ms") : null,
    gasBurnt: outcomes.length ? gas.toString() : null,
    tokensBurntYocto: outcomes.length ? burnt.toString() : null,
    methods: methodsOf(v.transaction.actions),
    rawFailure: failed ? JSON.stringify((status as { Failure?: unknown }).Failure) : null,
    ...(failed
      ? { decodedError: decodeNearError((status as { Failure?: unknown }).Failure, receiverId) }
      : {}),
  }
}

/** Block height and time, or null. A missing block is never an invented time. */
async function blockOf(blockHash: string | undefined): Promise<{ height: number; iso: string; ms: number } | null> {
  if (!blockHash) return null
  const r = await nearRpc<{ header?: { height?: number; timestamp_nanosec?: string; timestamp?: number } }>(
    "block", { block_id: blockHash })
  if (r.kind !== "ok") return null
  const h = r.value.header
  if (typeof h?.height !== "number") return null
  const nanos = typeof h.timestamp_nanosec === "string" ? h.timestamp_nanosec
    : typeof h.timestamp === "number" ? String(h.timestamp) : null
  if (!nanos || !/^\d+$/.test(nanos)) return { height: h.height, iso: "", ms: NaN }
  const ms = Number(BigInt(nanos) / 1_000_000n)
  return { height: h.height, iso: new Date(ms).toISOString(), ms }
}
