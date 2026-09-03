/**
 * The TxID Resolution Object: one typed statement about one attempted on-chain
 * action. Spec: docs/superpowers/specs/2026-08-25-resolution-object-spec.md
 *
 * This is the object all three products consume. The API returns it unchanged,
 * the SDK renders it inline, the Console indexes it. The widget's prose must be
 * generated FROM this object, never in parallel with it, or the surfaces drift.
 *
 * PURE MODULE: no network, no database, no framework imports. Everything here
 * is data and mapping, so it can be tested exhaustively and called from a route,
 * a worker, or a script without setup.
 */

/** Where in the lifecycle the attempt broke. Objective; responsibility is separate. */
export type Category =
  | "SUBMISSION"
  | "BALANCE"
  | "MEMPOOL"
  | "APPROVAL"
  | "PROTOCOL_CONDITION"
  | "CONTRACT_DEFECT"
  | "SETTLEMENT"
  | "OFFCHAIN_PROCESS"
  | "INDETERMINATE"

/**
 * What happened to the attempt. `succeeded_intent_unmet` is the one no block
 * explorer can produce: the transaction worked, the customer's goal did not.
 */
export type Status =
  | "not_submitted"
  | "pending"
  | "failed"
  | "succeeded"
  | "succeeded_intent_unmet"
  /** We could not determine what happened. Distinct from "failed", which is a finding. */
  | "indeterminate"

/**
 * What was OBSERVED about the user's assets. Deliberately not "funds_safe":
 * that is a claim with liability attached, and it is the consumer's to make,
 * in their voice, when custody is "unchanged".
 */
export type Custody = "unchanged" | "moved" | "partial" | "unknown"

/** Who can act next. NOT who is at fault: we never attribute blame to a named party. */
export type Owner = "user" | "application" | "protocol" | "infrastructure" | "none" | "unknown"

export type Retryable = "yes" | "after_change" | "no" | "unknown"

/**
 * How well founded the answer is. The same ladder the Case Record uses, and
 * deliberately NOT a confidence percentage: a number invites a challenge it
 * cannot survive and tells an operator nothing actionable.
 */
export type Basis = "verified" | "derived" | "reported" | "indeterminate"

/** What the caller says the user was trying to do. Only they can know this. */
export type Intent =
  | "swap" | "transfer" | "approve" | "deposit" | "withdraw"
  | "stake" | "unstake" | "claim" | "bridge" | "mint" | "burn"
  | "place_order" | "cancel_order" | "lock" | "other"

/** Recommended next action, as a code the consumer can branch on. */
export type ActionCode =
  | "RETRY_AS_IS"
  | "RETRY_WITH_HIGHER_GAS_LIMIT"
  | "RETRY_WITH_HIGHER_FEE"
  | "ADD_NATIVE_GAS"
  | "ADD_TOKEN_BALANCE"
  | "APPROVE_TOKEN"
  | "ADJUST_SLIPPAGE"
  | "ADJUST_ORDER_PARAMS"
  | "REDUCE_AMOUNT"
  | "SWITCH_NETWORK"
  | "WAIT"
  | "REFRESH_AND_RECHECK"
  | "CONTACT_PROTOCOL"
  | "CONTACT_SUPPORT"
  | "REPORT_TO_DEVELOPER"
  | "NO_ACTION"

/**
 * Evidence behind the answer. Structurally identical to EvidenceSource in
 * packages/ai/src/evidence.ts, redeclared here so this module stays dependency
 * free. `origin` on a transaction is load-bearing: a hash the user pasted is a
 * claim about their history, one we found is a finding of ours.
 */
export type EvidenceItem =
  | { kind: "documentation"; url: string; version?: string }
  | { kind: "contract"; address: string; chain?: string; fn?: string }
  | { kind: "transaction"; hash: string; chain?: string; origin: "looked_up" | "user_supplied" }
  | { kind: "price"; asset: string; value: string; via?: string }
  | { kind: "position"; protocol?: string; account: string }
  | { kind: "parameter"; name: string; value: string; via?: string }

/** A registry entry: what a code MEANS, independent of any one transaction. */
export interface RegistryEntry {
  code: string
  cause: string
  category: Category
  /** Default assessment for this condition; a case may narrow it with observed data. */
  custody: Custody
  next_action_owner: Owner
  retryable: Retryable
  recommended_action: ActionCode
  /** Consumer-facing default wording. A case may override with specifics. */
  summary: string
  detail: string
  next_step?: string
}

/** The object itself. */
export interface Resolution {
  txid_code: string
  cause: string
  category: Category

  status: Status
  intent?: Intent
  intent_met?: boolean

  custody: Custody
  gas_spent: boolean
  next_action_owner: Owner
  retryable: Retryable
  recommended_action: ActionCode

  summary: string
  detail: string
  next_step?: string

  basis: Basis
  evidence: EvidenceItem[]
  raw?: string
  chain?: string
  hash?: string
  observed_at: string
  chain_state_at?: string
}

/**
 * Everything the resolver needs, already gathered. Keeping the fetch OUT of this
 * module is what makes it pure: callers bring evidence, this decides what it means.
 *
 * Shapes mirror the existing decoders (packages/blockchain DecodedRevert and
 * PendingDiagnosis, packages/aptos decodeAbort) structurally, so a caller can
 * pass their output straight through without a translation step.
 */
export interface ResolveInput {
  chain?: string
  hash?: string
  /** Observed on-chain outcome, when a transaction was found at all. */
  onchain?: "success" | "failure" | "pending" | "not_found"
  /** packages/blockchain DecodedRevert (EVM). */
  revert?: {
    cause: "out_of_gas" | "revert_reason" | "custom_error" | "panic" | "unknown_revert" | "state_dependent"
    reason?: string
    errorName?: string
    rawHex?: string
    gasInfo?: { used: number; limit: number; percentUsed: number }
  }
  /** packages/blockchain PendingDiagnosis (EVM, hash not mined). */
  pending?: {
    cause:
      | "pending_stuck_nonce"
      | "pending_underpriced"
      | "pending_congestion"
      | "dropped"
      | "insufficient_gas_balance"
      | "lookup_failed"
    reason?: string
  }
  /** packages/aptos decodeAbort output. */
  abort?: {
    cause: "move_abort" | "out_of_gas" | "execution_failure" | "unknown"
    module?: string
    code?: number
    errorName?: string
    reason?: string
    /** True when a protocol errmap supplied the meaning, not just the constant name. */
    mapped?: boolean
  }
  /** A raw wallet or RPC error string, when nothing reached the chain. */
  walletError?: string
  /** Caller-declared context. Only the integrating product can know these. */
  intent?: Intent
  /** Caller-declared off-chain workflow state, e.g. from a Partner integration. */
  offchainState?: "compliance_review" | "operator_approval" | "hold" | "settled"
  /** Whether the user's goal was met, when the caller can determine it. */
  intentMet?: boolean
  /** Block height or ledger version the reads were true as of. */
  chainStateAt?: string
  /** Evidence the caller already collected. */
  evidence?: EvidenceItem[]
  /** Timestamp of the read. Injected so the function stays deterministic in tests. */
  observedAt?: string
}
