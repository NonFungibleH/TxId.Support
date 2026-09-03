/**
 * Adapters: existing decoder output to ResolveInput.
 *
 * The gathering layer already exists and works (diagnoseTransaction does the
 * multi-chain EVM fan-out; getAptosTransactionByHash does Aptos). What it
 * returns is the OLD ad-hoc shape: prose plus a loose `cause` string. These
 * adapters translate that into the resolver's input contract, so no fetching
 * logic is duplicated and no existing consumer of the old shape is disturbed.
 *
 * PURE. Both functions are total, synchronous and side-effect free, so the
 * mapping can be tested exhaustively without touching a network.
 */

import type { Intent, ResolveInput } from "./types"

/** The pending/dropped causes, which arrive on the same `cause` field as reverts. */
export const PENDING_CAUSES = new Set([
  "pending_stuck_nonce",
  "pending_underpriced",
  "pending_congestion",
  "dropped",
  "insufficient_gas_balance",
  // Not a mempool state. Routed here only so the node's own wording reaches
  // `raw`; classify() maps it to INSUFFICIENT_EVIDENCE, never to DROPPED.
  "lookup_failed",
])

/** The five decoder revert causes. */
const REVERT_CAUSES = new Set(["out_of_gas", "revert_reason", "custom_error", "panic", "unknown_revert", "state_dependent"])

/** Structural shape of @txid/blockchain TxDiagnosis. Redeclared to keep this module dependency free. */
export interface EvmDiagnosisLike {
  status: "success" | "failed" | "pending" | "not_found"
  chain?: string | null
  chainId?: string | null
  cause?: string | null
  error?: string | null
  explanation?: string
  fix?: string | null
  method?: string | null
}

/** Extra context only the caller can supply. */
export interface CallerContext {
  intent?: Intent
  intentMet?: boolean
  offchainState?: ResolveInput["offchainState"]
  chainStateAt?: string
  observedAt?: string
}

/**
 * EVM diagnosis to resolver input.
 *
 * The one subtlety: TxDiagnosis packs revert causes AND pending causes onto a
 * single `cause` string, so this splits them back apart into the two typed
 * branches the resolver expects.
 */
export function fromEvmDiagnosis(d: EvmDiagnosisLike, hash: string, ctx: CallerContext = {}): ResolveInput {
  const cause = d.cause ?? ""
  const onchain: ResolveInput["onchain"] =
    d.status === "success" ? "success"
    : d.status === "failed" ? "failure"
    : d.status === "pending" ? "pending"
    : "not_found"

  const base: ResolveInput = {
    hash,
    onchain,
    ...(d.chainId ? { chain: d.chainId } : {}),
    ...(ctx.intent ? { intent: ctx.intent } : {}),
    ...(ctx.intentMet === undefined ? {} : { intentMet: ctx.intentMet }),
    ...(ctx.offchainState ? { offchainState: ctx.offchainState } : {}),
    ...(ctx.chainStateAt ? { chainStateAt: ctx.chainStateAt } : {}),
    ...(ctx.observedAt ? { observedAt: ctx.observedAt } : {}),
  }

  if (PENDING_CAUSES.has(cause)) {
    return {
      ...base,
      pending: {
        cause: cause as NonNullable<ResolveInput["pending"]>["cause"],
        ...(d.explanation ? { reason: d.explanation } : {}),
      },
    }
  }

  if (d.status === "failed") {
    return {
      ...base,
      revert: {
        cause: (REVERT_CAUSES.has(cause) ? cause : "unknown_revert") as NonNullable<ResolveInput["revert"]>["cause"],
        ...(d.explanation ? { reason: d.explanation } : {}),
        ...(d.error ? { errorName: d.error } : {}),
      },
    }
  }

  return base
}

/** Structural shape of @txid/aptos AptosTransaction plus its decoded abort. */
export interface AptosTxLike {
  hash?: string
  success?: boolean
  vmStatus?: string
  version?: string | number
  /** Fields are `| null` (not undefined) to match @txid/aptos DecodedAbort exactly. */
  decodedAbort?: {
    cause: "move_abort" | "out_of_gas" | "execution_failure" | "unknown"
    module?: string | null
    code?: number | null
    errorName?: string | null
    reason?: string | null
  }
}

/**
 * Aptos transaction to resolver input.
 *
 * `mapped` is the load-bearing bit: a reason that came from a protocol errmap
 * is a meaning we can stand behind, while a bare module-and-code is not, and
 * the resolver routes those to different codes rather than guessing. The
 * decoder signals "unmapped" by falling back to wording that names the module
 * and code and says no description is published.
 */
export function fromAptosTx(tx: AptosTxLike, hash: string, ctx: CallerContext = {}): ResolveInput {
  const base: ResolveInput = {
    hash,
    chain: "aptos",
    onchain: tx.success === false ? "failure" : "success",
    ...(tx.version ? { chainStateAt: String(tx.version) } : {}),
    ...(ctx.intent ? { intent: ctx.intent } : {}),
    ...(ctx.intentMet === undefined ? {} : { intentMet: ctx.intentMet }),
    ...(ctx.offchainState ? { offchainState: ctx.offchainState } : {}),
    ...(ctx.chainStateAt ? { chainStateAt: ctx.chainStateAt } : {}),
    ...(ctx.observedAt ? { observedAt: ctx.observedAt } : {}),
  }

  if (!tx.decodedAbort) return base

  const a = tx.decodedAbort
  const unmapped = !a.reason || /does not publish|no description|doesn't publish/i.test(a.reason)
  return {
    ...base,
    abort: {
      cause: a.cause,
      mapped: !unmapped,
      ...(a.module ? { module: a.module } : {}),
      ...(a.code === undefined || a.code === null ? {} : { code: a.code }),
      ...(a.errorName ? { errorName: a.errorName } : {}),
      ...(a.reason ? { reason: a.reason } : {}),
    },
  }
}

/** Nothing was found on any chain we checked. Says so, never guesses why. */
export function notFound(hash: string, ctx: CallerContext = {}): ResolveInput {
  return {
    hash,
    onchain: "not_found",
    ...(ctx.intent ? { intent: ctx.intent } : {}),
    ...(ctx.offchainState ? { offchainState: ctx.offchainState } : {}),
    ...(ctx.observedAt ? { observedAt: ctx.observedAt } : {}),
  }
}
