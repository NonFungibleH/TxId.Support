/**
 * The resolver: evidence in, Resolution out.
 *
 * PURE AND SYNCHRONOUS BY DESIGN. Fetching stays outside this module, so the
 * caller brings evidence and this decides what it means. That is what makes the
 * whole thing exhaustively testable, and what lets a route, a worker, a backfill
 * script and (later) the widget all reach the same verdict from the same inputs.
 *
 * Precedence, highest first:
 *   1. Caller-declared off-chain state. The chain cannot see a compliance hold,
 *      and "no transaction exists" is the WRONG answer when the real answer is
 *      "no transaction has been created yet".
 *   2. A decoded on-chain failure (Move abort or EVM revert).
 *   3. A pending diagnosis for a hash that never mined.
 *   4. A raw wallet or RPC error string, when nothing reached the chain.
 *   5. Bare on-chain status.
 *   6. Indeterminate. We never guess.
 */

import { REGISTRY } from "./registry"
import type { Basis, EvidenceItem, Resolution, ResolveInput, Status } from "./types"

/** Case-insensitive "does the haystack contain any of these needles". */
function has(haystack: string | undefined, ...needles: string[]): boolean {
  if (!haystack) return false
  const h = haystack.toLowerCase()
  return needles.some(n => h.includes(n.toLowerCase()))
}

/** Map an EVM revert or Move abort error NAME to a protocol-condition code. */
function codeFromErrorText(text: string | undefined): string | null {
  if (!text) return null
  // Order matters: the more specific patterns must be tested first.
  if (has(text, "allowance", "insufficient-allowance", "STF", "TRANSFER_FROM_FAILED")) return "TXID-4001"
  if (has(text, "TRANSFER_FAILED", "low-level call failed", "transfer rejected")) return "TXID-4002"
  if (has(text, "exceeds balance", "INSUFFICIENT_FUNDS", "INSUFFICIENT_PFS_FUNDS", "insufficient balance")) return "TXID-2005"
  if (has(text, "INSUFFICIENT_OUTPUT_AMOUNT", "slippage", "UniswapV2: K", "price impact")) return "TXID-5001"
  if (has(text, "INSUFFICIENT_INPUT_AMOUNT", "below minimum", "TOO_SMALL", "MIN_SIZE")) return "TXID-5002"
  if (has(text, "INSUFFICIENT_LIQUIDITY", "not enough liquidity")) return "TXID-5003"
  if (has(text, "EXPIRED", "deadline")) return "TXID-5004"
  if (has(text, "paused", "halted")) return "TXID-5005"
  if (has(text, "ORDER_NOT_FOUND", "INVALID_TP_SL", "order does not exist")) return "TXID-5006"
  if (has(text, "TICK", "SIZE_TOO", "NOTIONAL", "CROSS", "PRICE_INVALID")) return "TXID-5007"
  if (has(text, "not the owner", "caller is not", "NOT_SUBACCOUNT_OWNER", "permission", "unauthorized", "unauthorised")) return "TXID-4003"
  if (has(text, "reentran")) return "TXID-6005"
  if (has(text, "overflow", "underflow", "subtraction overflow")) return "TXID-6001"
  return null
}

/** Solidity panic selector to a contract-defect code. */
function codeFromPanic(text: string | undefined): string {
  if (has(text, "0x11")) return "TXID-6001"
  if (has(text, "0x12")) return "TXID-6002"
  if (has(text, "0x32")) return "TXID-6003"
  if (has(text, "0x01")) return "TXID-6004"
  return "TXID-6006"
}

/** A raw wallet or RPC error string to a code. Nothing here reached the chain. */
function codeFromWalletError(text: string): string {
  if (has(text, "user rejected", "user denied", "rejected the request", "ACTION_REJECTED")) return "TXID-1001"
  if (has(text, "wrong network", "unrecognized chain", "chain mismatch", "switch network")) return "TXID-1002"
  if (has(text, "nonce too low")) return "TXID-3001"
  if (has(text, "nonce too high")) return "TXID-3002"
  if (has(text, "already known")) return "TXID-3005"
  if (has(text, "replacement transaction underpriced")) return "TXID-3004"
  if (has(text, "insufficient funds")) return "TXID-2001"
  if (has(text, "intrinsic gas too low", "gas required exceeds")) return "TXID-2002"
  if (has(text, "exceeds block gas limit")) return "TXID-2004"
  if (has(text, "underpriced", "less than block base fee", "max priority fee")) return "TXID-3003"
  if (has(text, "cannot estimate gas", "likely to fail", "may fail")) return "TXID-1004"
  if (has(text, "internal json-rpc", "header not found", "timeout", "econnreset")) return "TXID-1003"
  return "TXID-9004"
}

/** Off-chain workflow state, when the caller supplies it. */
const OFFCHAIN_CODES: Record<string, string> = {
  compliance_review: "TXID-8001",
  operator_approval: "TXID-8002",
  hold: "TXID-8003",
}

/** Which codes describe something that never executed, so no fee was charged. */
const NO_FEE_CODES = new Set([
  "TXID-1001", "TXID-1002", "TXID-1003", "TXID-1004", "TXID-1005", "TXID-1006",
  "TXID-2001", "TXID-2002", "TXID-2004",
  "TXID-3001", "TXID-3002", "TXID-3003", "TXID-3004", "TXID-3005",
  "TXID-3006", "TXID-3007", "TXID-3008",
  "TXID-8001", "TXID-8002", "TXID-8003",
  "TXID-9003",
])

/** Which codes mean the attempt is still in flight rather than finished. */
const PENDING_CODES = new Set(["TXID-3002", "TXID-3005", "TXID-3006", "TXID-3007", "TXID-7001", "TXID-7002", "TXID-7004"])

/** Codes that describe something never submitted to the network at all. */
const NOT_SUBMITTED_CODES = new Set([
  "TXID-1001", "TXID-1002", "TXID-1003", "TXID-1004", "TXID-1005", "TXID-1006",
  "TXID-8001", "TXID-8002", "TXID-8003",
])

/** Pick the code. This is the whole classification decision, in precedence order. */
function classify(input: ResolveInput): string {
  // 1. Off-chain state wins: the chain cannot see it and would answer wrongly.
  if (input.offchainState && input.offchainState !== "settled") {
    return OFFCHAIN_CODES[input.offchainState] ?? "TXID-9004"
  }

  // 2. A decoded on-chain failure.
  if (input.abort) {
    if (input.abort.cause === "out_of_gas") return "TXID-2003"
    if (input.abort.cause === "move_abort") {
      const named = codeFromErrorText(input.abort.errorName) ?? codeFromErrorText(input.abort.reason)
      if (named) return named
      // A meaning we trust is a protocol rule; an unmapped code is not guessed at.
      return input.abort.mapped ? "TXID-5008" : "TXID-9002"
    }
    if (input.abort.cause === "execution_failure") return "TXID-9001"
    return "TXID-9004"
  }

  if (input.revert) {
    if (input.revert.cause === "out_of_gas") return "TXID-2003"
    if (input.revert.cause === "panic") return codeFromPanic(input.revert.reason ?? input.revert.errorName)
    if (input.revert.cause === "revert_reason" || input.revert.cause === "custom_error") {
      const named = codeFromErrorText(input.revert.errorName) ?? codeFromErrorText(input.revert.reason)
      if (named) return named
      return input.revert.cause === "custom_error" ? "TXID-5008" : "TXID-9001"
    }
    return "TXID-9001"
  }

  // 3. A hash that never mined.
  if (input.pending) {
    switch (input.pending.cause) {
      case "pending_stuck_nonce": return "TXID-3006"
      case "pending_underpriced": return "TXID-3003"
      case "pending_congestion": return "TXID-3007"
      case "dropped": return "TXID-3008"
      // An unreachable node is not evidence of anything. TXID-9004 carries
      // custody "unknown" and retryable "unknown", which is the truth.
      case "lookup_failed": return "TXID-9004"
      case "insufficient_gas_balance": return "TXID-2001"
    }
  }

  // 4. A raw wallet or RPC string.
  if (input.walletError) return codeFromWalletError(input.walletError)

  // 5. Bare on-chain status.
  if (input.onchain === "success") {
    return input.intentMet === false ? "TXID-7003" : "TXID-0001"
  }
  if (input.onchain === "pending") return "TXID-3007"
  if (input.onchain === "not_found") return "TXID-9003"

  // 6. We will not guess.
  return "TXID-9004"
}

/** Status follows from the code plus what was observed. */
function statusFor(code: string, input: ResolveInput): Status {
  if (code === "TXID-0001") return "succeeded"
  if (code === "TXID-7003") return "succeeded_intent_unmet"
  if (NOT_SUBMITTED_CODES.has(code)) return "not_submitted"
  if (PENDING_CODES.has(code)) return "pending"
  if (input.onchain === "success") return input.intentMet === false ? "succeeded_intent_unmet" : "succeeded"
  return "failed"
}

/**
 * How well founded the answer is. Deliberately conservative: a chain read earns
 * "verified", a string match earns "derived", something a party told us earns
 * "reported", and an INDETERMINATE code is never dressed up as better than it is.
 */
function basisFor(code: string, input: ResolveInput): Basis {
  const cat = REGISTRY[code]?.category
  if (cat === "INDETERMINATE") return "indeterminate"
  if (input.offchainState && input.offchainState !== "settled") return "reported"
  if ((input.abort || input.revert) && (input.onchain === "failure" || input.onchain === "success")) return "verified"
  if (input.abort || input.revert) return "derived"
  if (input.onchain === "success" || input.onchain === "failure") return "verified"
  if (input.pending || input.walletError) return "derived"
  return "indeterminate"
}

/**
 * Turn gathered evidence into a Resolution.
 *
 * Never throws: an input it cannot classify resolves to TXID-9004
 * INSUFFICIENT_EVIDENCE, because "we do not know" is a valid answer and a
 * thrown error in a support path is not.
 */
export function resolve(input: ResolveInput): Resolution {
  const code = classify(input)
  const reg = REGISTRY[code] ?? REGISTRY["TXID-9004"]!
  const status = statusFor(code, input)

  // A fee is charged only when the transaction actually executed.
  const executed = input.onchain === "failure" || input.onchain === "success" || !!input.revert || !!input.abort
  const gas_spent = executed && !NO_FEE_CODES.has(code)

  const evidence: EvidenceItem[] = [...(input.evidence ?? [])]
  const alreadyHasTx = evidence.some(e => e.kind === "transaction")
  if (input.hash && !alreadyHasTx) {
    evidence.push({
      kind: "transaction",
      hash: input.hash,
      origin: "looked_up",
      ...(input.chain ? { chain: input.chain } : {}),
    })
  }
  if (input.abort?.module) {
    evidence.push({
      kind: "contract",
      address: input.abort.module.split("::")[0] ?? input.abort.module,
      ...(input.chain ? { chain: input.chain } : {}),
      ...(input.abort.module.includes("::") ? { fn: input.abort.module.split("::").slice(1).join("::") } : {}),
    })
  }

  const raw =
    input.abort?.reason ??
    input.revert?.reason ??
    input.pending?.reason ??
    input.walletError

  return {
    txid_code: reg.code,
    cause: reg.cause,
    category: reg.category,

    status,
    ...(input.intent ? { intent: input.intent } : {}),
    ...(input.intentMet === undefined ? {} : { intent_met: input.intentMet }),

    custody: reg.custody,
    gas_spent,
    next_action_owner: reg.next_action_owner,
    retryable: reg.retryable,
    recommended_action: reg.recommended_action,

    summary: reg.summary,
    detail: reg.detail,
    ...(reg.next_step ? { next_step: reg.next_step } : {}),

    basis: basisFor(code, input),
    evidence,
    ...(raw ? { raw } : {}),
    ...(input.chain ? { chain: input.chain } : {}),
    ...(input.hash ? { hash: input.hash } : {}),
    observed_at: input.observedAt ?? new Date().toISOString(),
    ...(input.chainStateAt ? { chain_state_at: input.chainStateAt } : {}),
  }
}
