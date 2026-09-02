/**
 * The TxID Registry: what each code MEANS, independent of any one transaction.
 *
 * PROVENANCE. These entries are mapped from failures TxID already diagnoses,
 * not invented: the 43 entries in the public error reference (apps/web/lib/errors.ts),
 * the EVM decoder's typed causes and PendingDiagnosis (packages/blockchain),
 * and the Move abort maps (packages/aptos/src/errmap.ts).
 *
 * TWO RULES for adding a code:
 *   1. A code is CHAIN-AGNOSTIC. TXID-2001 covers Ethereum ETH, Avalanche AVAX,
 *      Aptos APT and a failed paymaster sponsorship. Chain specifics belong in
 *      the case fields, never in the code.
 *   2. A code names the CONDITION, never the fix. Fixes change with protocol
 *      versions; conditions do not.
 *
 * Wording note: these strings are consumer-facing defaults. No em dashes
 * (site style rule), and never assert "funds are safe" here: the object reports
 * observed custody and the consumer chooses how to phrase reassurance.
 */

import type { RegistryEntry } from "./types"

const E = (e: RegistryEntry): RegistryEntry => e

export const REGISTRY: Record<string, RegistryEntry> = Object.fromEntries(
  [
    // ── 0xxx NO FAULT: it worked ──────────────────────────────────────────
    E({
      code: "TXID-0001", cause: "SUCCEEDED", category: "SETTLEMENT",
      custody: "moved", next_action_owner: "none", retryable: "no", recommended_action: "NO_ACTION",
      summary: "The transaction succeeded.",
      detail: "It executed on chain and completed without error.",
    }),

    // ── 1xxx SUBMISSION: it never really started ──────────────────────────
    E({
      code: "TXID-1001", cause: "USER_REJECTED_SIGNATURE", category: "SUBMISSION",
      custody: "unchanged", next_action_owner: "user", retryable: "yes", recommended_action: "RETRY_AS_IS",
      summary: "The request was declined in the wallet.",
      detail: "The transaction was never signed, so it never reached the network. Nothing was spent, not even a network fee.",
      next_step: "Try again and approve the request in your wallet.",
    }),
    E({
      code: "TXID-1002", cause: "WRONG_NETWORK", category: "SUBMISSION",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "SWITCH_NETWORK",
      summary: "The wallet is connected to a different network than this app uses.",
      detail: "Nothing can be sent until the wallet is on the expected network. No funds moved.",
      next_step: "Switch networks in your wallet, then try again.",
    }),
    E({
      code: "TXID-1003", cause: "RPC_UNAVAILABLE", category: "SUBMISSION",
      // A timeout does not prove the transaction was never sent: a broadcast
      // can succeed and the response can time out. So custody is unknown and
      // the action is to check, never to resubmit blind.
      custody: "unknown", next_action_owner: "infrastructure", retryable: "unknown", recommended_action: "REFRESH_AND_RECHECK",
      summary: "The node the wallet is using did not respond, so it is not known whether the transaction was sent.",
      detail: "A connection problem between the wallet and its node provider. The request may or may not have reached the network before it failed, so do not assume nothing happened.",
      next_step: "Wait a moment, refresh, and check the wallet's activity before trying again. If it keeps happening, switch RPC endpoint in the wallet.",
    }),
    E({
      code: "TXID-1004", cause: "SIMULATION_PREDICTS_FAILURE", category: "SUBMISSION",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "CONTACT_SUPPORT",
      summary: "The wallet simulated this transaction and it would fail.",
      detail: "Treat this as a stop sign rather than an inconvenience: forcing it through will most likely fail and still cost a fee. The cause is upstream, commonly a missing approval, the wrong network, or a protocol condition not met.",
      next_step: "Find out why it would fail before retrying.",
    }),
    E({
      code: "TXID-1005", cause: "NEVER_BROADCAST", category: "SUBMISSION",
      custody: "unchanged", next_action_owner: "user", retryable: "yes", recommended_action: "RETRY_AS_IS",
      summary: "No record of this transaction exists on the network.",
      detail: "It was dropped, replaced, or never broadcast. A wallet can show a hash for a transaction that never reached a validator.",
      next_step: "Try again.",
    }),
    E({
      code: "TXID-1006", cause: "TRANSACTION_EXPIRED", category: "SUBMISSION",
      custody: "unchanged", next_action_owner: "user", retryable: "yes", recommended_action: "RETRY_AS_IS",
      summary: "The transaction expired before it was committed.",
      detail: "Every transaction carries an expiry. Once it passes without commitment the transaction is permanently invalid and leaves no on-chain record, even though the wallet showed a hash. Nothing was spent.",
      next_step: "Submit it again.",
    }),

    // ── 2xxx BALANCE: not enough of something to pay with ─────────────────
    E({
      code: "TXID-2001", cause: "INSUFFICIENT_GAS_BALANCE", category: "BALANCE",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "ADD_NATIVE_GAS",
      summary: "The wallet does not hold enough of the network's own token to pay the fee.",
      detail: "Network fees are paid in the chain's native token, separately from whatever is being sent. Holding the token being transferred is not enough.",
      next_step: "Add a small amount of the network's native token, then retry.",
    }),
    E({
      code: "TXID-2002", cause: "GAS_LIMIT_TOO_LOW", category: "BALANCE",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "RETRY_WITH_HIGHER_GAS_LIMIT",
      summary: "The gas limit was below what the network requires to accept the transaction.",
      detail: "This is the limit set on the transaction, not the wallet's balance. Wallets normally estimate it, so this usually means a manual value was set too low.",
      next_step: "Clear the custom gas limit and let the wallet estimate it.",
    }),
    E({
      code: "TXID-2003", cause: "OUT_OF_GAS", category: "BALANCE",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "RETRY_WITH_HIGHER_GAS_LIMIT",
      summary: "The transaction ran out of the computation it was allowed.",
      detail: "It is the gas limit that ran out, not the wallet balance. The work done before it stopped is discarded, but the fee for that work is still charged.",
      next_step: "Raise the gas limit in the wallet's advanced settings and retry.",
    }),
    E({
      code: "TXID-2004", cause: "EXCEEDS_BLOCK_GAS_LIMIT", category: "BALANCE",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "REDUCE_AMOUNT",
      summary: "The transaction asks for more computation than a single block allows.",
      detail: "No validator can include it at this size, whatever fee is offered.",
      next_step: "Split the action into smaller transactions.",
    }),
    E({
      code: "TXID-2005", cause: "INSUFFICIENT_TOKEN_BALANCE", category: "BALANCE",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "ADD_TOKEN_BALANCE",
      summary: "The wallet does not hold enough of the token this action needs.",
      detail: "The balance is checked before anything moves, so nothing was transferred and only the network fee was spent.",
      next_step: "Top up the balance, or reduce the amount, and retry.",
    }),

    // ── 3xxx MEMPOOL: the network would not include it ────────────────────
    E({
      code: "TXID-3001", cause: "NONCE_TOO_LOW", category: "MEMPOOL",
      // The earlier transaction with this nonce already mined. If it was the
      // same intent, a wallet retry or a double-click, the funds moved. Same
      // situation as DUPLICATE_SUBMISSION, so the same custody answer.
      custody: "unknown", next_action_owner: "user", retryable: "yes", recommended_action: "REFRESH_AND_RECHECK",
      summary: "This transaction reused a number that an earlier transaction already used.",
      detail: "Transactions from one account are strictly ordered. A number already spent can never be used again, and the earlier transaction that used it may have executed, so check before resubmitting.",
      next_step: "Refresh the wallet so it reads the current count, then try again.",
    }),
    E({
      code: "TXID-3002", cause: "NONCE_GAP", category: "MEMPOOL",
      custody: "unchanged", next_action_owner: "user", retryable: "yes", recommended_action: "WAIT",
      summary: "This transaction is numbered ahead of one that has not arrived yet.",
      detail: "The network holds it until the gap is filled. It is not lost, it is queued behind a missing predecessor.",
      next_step: "Wait for the earlier transaction, or reset the wallet's transaction count.",
    }),
    E({
      code: "TXID-3003", cause: "FEE_BELOW_NETWORK_RATE", category: "MEMPOOL",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "RETRY_WITH_HIGHER_FEE",
      summary: "The fee offered is below what the network currently requires.",
      detail: "Validators will not include it while the offered fee sits under the going rate. It is not failed, it is unattractive.",
      next_step: "Resubmit with a higher fee, or speed it up from the wallet.",
    }),
    E({
      code: "TXID-3004", cause: "REPLACEMENT_UNDERPRICED", category: "MEMPOOL",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "RETRY_WITH_HIGHER_FEE",
      summary: "A replacement was offered at too small an increase over the original.",
      detail: "Replacing a pending transaction requires a meaningful fee increase, commonly at least ten per cent.",
      next_step: "Retry the replacement with a clearly higher fee.",
    }),
    E({
      code: "TXID-3005", cause: "DUPLICATE_SUBMISSION", category: "MEMPOOL",
      custody: "unknown", next_action_owner: "none", retryable: "no", recommended_action: "WAIT",
      summary: "This exact transaction has already been submitted.",
      detail: "The network already holds it. Submitting again changes nothing.",
      next_step: "Wait for the original to confirm.",
    }),
    E({
      code: "TXID-3006", cause: "STUCK_BEHIND_PENDING", category: "MEMPOOL",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "RETRY_WITH_HIGHER_FEE",
      summary: "An earlier transaction from this wallet is blocking this one.",
      detail: "Transactions confirm in order. Until the earlier one clears, nothing behind it can be included.",
      next_step: "Speed up or cancel the earlier transaction.",
    }),
    E({
      code: "TXID-3007", cause: "AWAITING_INCLUSION", category: "MEMPOOL",
      custody: "unchanged", next_action_owner: "none", retryable: "no", recommended_action: "WAIT",
      summary: "The transaction is waiting to be included in a block.",
      detail: "It has been accepted by the network and is queued. No action is needed.",
      next_step: "Wait for confirmation.",
    }),
    E({
      code: "TXID-3008", cause: "DROPPED_OR_REPLACED", category: "MEMPOOL",
      custody: "unchanged", next_action_owner: "user", retryable: "yes", recommended_action: "RETRY_AS_IS",
      summary: "The transaction was dropped from the network's queue.",
      detail: "Pending transactions can be evicted after long waits or when replaced. It never executed, so nothing moved.",
      next_step: "Submit it again.",
    }),

    // ── 4xxx APPROVAL: permission to move the tokens was missing ──────────
    E({
      code: "TXID-4001", cause: "ALLOWANCE_INSUFFICIENT", category: "APPROVAL",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "APPROVE_TOKEN",
      summary: "The contract is not approved to move this amount of the token.",
      detail: "Moving a token on someone's behalf requires an approval first. Either none was given, or the approved amount is below what this action needs.",
      next_step: "Approve the token for this contract, then retry.",
    }),
    E({
      code: "TXID-4002", cause: "TOKEN_TRANSFER_REJECTED", category: "APPROVAL",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "CONTACT_SUPPORT",
      summary: "The token itself refused the transfer.",
      detail: "The token contract rejected the movement. Common causes are a transfer fee, a blocklist, a paused token, or a transfer restriction on the token.",
      next_step: "Check the token's own rules before retrying.",
    }),
    E({
      code: "TXID-4003", cause: "CALLER_NOT_PERMITTED", category: "APPROVAL",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "CONTACT_SUPPORT",
      summary: "This wallet is not permitted to perform this action.",
      detail: "The contract restricts this function to specific addresses or roles, and the signing wallet is not one of them.",
      next_step: "Use the wallet that holds the permission, or request access from the protocol.",
    }),

    // ── 5xxx PROTOCOL_CONDITION: the protocol's own rules rejected it ─────
    E({
      code: "TXID-5001", cause: "SLIPPAGE_EXCEEDED", category: "PROTOCOL_CONDITION",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "ADJUST_SLIPPAGE",
      summary: "The price moved beyond the slippage tolerance while the transaction was processing.",
      detail: "The contract rejected the trade rather than filling it at a worse price than allowed. Nothing was swapped.",
      next_step: "Raise the slippage tolerance a little and retry.",
    }),
    E({
      code: "TXID-5002", cause: "INPUT_BELOW_MINIMUM", category: "PROTOCOL_CONDITION",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "ADJUST_ORDER_PARAMS",
      summary: "The amount is below the minimum this protocol accepts.",
      detail: "The value sent rounds to nothing at this size, or sits under a configured floor.",
      next_step: "Increase the amount and retry.",
    }),
    E({
      code: "TXID-5003", cause: "INSUFFICIENT_LIQUIDITY", category: "PROTOCOL_CONDITION",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "REDUCE_AMOUNT",
      summary: "The pool does not hold enough liquidity for a trade this size.",
      detail: "There is not enough on the other side of the pair to fill it at any acceptable price.",
      next_step: "Trade a smaller amount, or route through a different pool.",
    }),
    E({
      code: "TXID-5004", cause: "DEADLINE_PASSED", category: "PROTOCOL_CONDITION",
      // The deadline is a parameter inside the transaction. Resubmitting it
      // unchanged resubmits an expired deadline.
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "RETRY_WITH_HIGHER_FEE",
      summary: "The transaction confirmed after its own deadline had passed.",
      detail: "A deadline protects against being executed at a stale price much later. It sat pending too long and was rejected on arrival.",
      next_step: "Retry, and consider a higher fee so it confirms sooner.",
    }),
    E({
      code: "TXID-5005", cause: "PROTOCOL_PAUSED", category: "PROTOCOL_CONDITION",
      custody: "unchanged", next_action_owner: "protocol", retryable: "no", recommended_action: "WAIT",
      summary: "The protocol has paused this action.",
      detail: "This is a protocol-side pause, not a problem with the wallet or the request. Pauses are usually deliberate and temporary.",
      next_step: "Wait for the protocol to resume, and check their channels for status.",
    }),
    E({
      code: "TXID-5006", cause: "ORDER_NOT_FOUND", category: "PROTOCOL_CONDITION",
      custody: "unchanged", next_action_owner: "none", retryable: "no", recommended_action: "REFRESH_AND_RECHECK",
      summary: "The order this request refers to is no longer live.",
      detail: "It was most likely already filled or cancelled by the time the request landed, which is common in fast markets. No position was affected.",
      next_step: "Refresh the order list. If the order is gone, there is nothing left to act on.",
    }),
    E({
      code: "TXID-5007", cause: "ORDER_CONSTRAINT_VIOLATED", category: "PROTOCOL_CONDITION",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "ADJUST_ORDER_PARAMS",
      summary: "The order breaks one of this market's rules.",
      detail: "Markets enforce constraints such as a tick size, a minimum size, a maximum notional, or bids that must sit below asks. The order was rejected before anything was placed.",
      next_step: "Adjust the order to the market's limits and resubmit.",
    }),
    E({
      code: "TXID-5009", cause: "STATE_CHANGED_IN_BLOCK", category: "PROTOCOL_CONDITION",
      custody: "unchanged", next_action_owner: "user", retryable: "yes", recommended_action: "RETRY_AS_IS",
      summary: "The transaction failed because of a condition that had already changed by the time it ran.",
      detail: "Replaying it against the block's prior state succeeds, which means another transaction changed a price, a balance or a position in the same block. On an exchange this is typically the price moving past the slippage limit or the liquidity being taken first. It reverted, so nothing moved.",
      next_step: "Retry. If it keeps happening, allow a little more slippage or submit with a higher fee so it lands sooner.",
    }),
    E({
      code: "TXID-5008", cause: "PROTOCOL_RULE_REJECTED", category: "PROTOCOL_CONDITION",
      custody: "unchanged", next_action_owner: "user", retryable: "after_change", recommended_action: "CONTACT_SUPPORT",
      summary: "The protocol rejected this action under one of its own rules.",
      detail: "The contract raised a named condition specific to this protocol.",
      next_step: "Check the protocol's requirements for this action.",
    }),

    // ── 6xxx CONTRACT_DEFECT: it hit a state it did not expect ────────────
    E({
      code: "TXID-6001", cause: "ARITHMETIC_OVERFLOW", category: "CONTRACT_DEFECT",
      custody: "unchanged", next_action_owner: "protocol", retryable: "no", recommended_action: "REPORT_TO_DEVELOPER",
      summary: "A calculation inside the contract went out of range.",
      detail: "A safety check stopped the transaction rather than letting a wrong number through. This is a contract-side condition, not something the wallet did wrong.",
      next_step: "Report it to the protocol with the transaction hash.",
    }),
    E({
      code: "TXID-6002", cause: "DIVISION_BY_ZERO", category: "CONTRACT_DEFECT",
      custody: "unchanged", next_action_owner: "protocol", retryable: "no", recommended_action: "REPORT_TO_DEVELOPER",
      summary: "The contract attempted a division by zero.",
      detail: "An automatic safety check stopped execution. It usually means a value the contract expected to be set was empty.",
      next_step: "Report it to the protocol with the transaction hash.",
    }),
    E({
      code: "TXID-6003", cause: "INDEX_OUT_OF_BOUNDS", category: "CONTRACT_DEFECT",
      custody: "unchanged", next_action_owner: "protocol", retryable: "no", recommended_action: "REPORT_TO_DEVELOPER",
      summary: "The contract read past the end of a list.",
      detail: "A safety check stopped execution. It commonly means an item the contract expected does not exist.",
      next_step: "Report it to the protocol with the transaction hash.",
    }),
    E({
      code: "TXID-6004", cause: "ASSERTION_FAILED", category: "CONTRACT_DEFECT",
      custody: "unchanged", next_action_owner: "protocol", retryable: "no", recommended_action: "REPORT_TO_DEVELOPER",
      summary: "An internal assumption inside the contract did not hold.",
      detail: "Assertions guard conditions the contract believes can never happen, so reaching one indicates a contract-side problem.",
      next_step: "Report it to the protocol with the transaction hash.",
    }),
    E({
      code: "TXID-6005", cause: "REENTRANCY_BLOCKED", category: "CONTRACT_DEFECT",
      custody: "unchanged", next_action_owner: "protocol", retryable: "after_change", recommended_action: "REPORT_TO_DEVELOPER",
      summary: "The contract blocked a nested call into itself.",
      detail: "A reentrancy guard stopped the transaction. This is a protection working as intended, commonly triggered by an unusual routing path.",
      next_step: "Retry through the protocol's own interface, and report it if it persists.",
    }),
    E({
      code: "TXID-6006", cause: "CONTRACT_INTERNAL_ERROR", category: "CONTRACT_DEFECT",
      custody: "unchanged", next_action_owner: "protocol", retryable: "no", recommended_action: "REPORT_TO_DEVELOPER",
      summary: "The contract stopped on an internal safety check.",
      detail: "The transaction reached a state the contract does not handle.",
      next_step: "Report it to the protocol with the transaction hash.",
    }),

    // ── 7xxx SETTLEMENT: it ran, the outcome is not complete ──────────────
    E({
      code: "TXID-7001", cause: "SOURCE_CONFIRMED_DESTINATION_PENDING", category: "SETTLEMENT",
      custody: "moved", next_action_owner: "none", retryable: "no", recommended_action: "WAIT",
      summary: "The first half completed and the second half has not arrived yet.",
      detail: "The source transaction confirmed. Settlement on the destination is still in progress, which is normal for cross-chain transfers.",
      next_step: "Wait for settlement. No action is needed.",
    }),
    E({
      code: "TXID-7002", cause: "SETTLEMENT_DELAYED", category: "SETTLEMENT",
      custody: "moved", next_action_owner: "infrastructure", retryable: "no", recommended_action: "CONTACT_SUPPORT",
      summary: "Settlement is taking longer than expected.",
      detail: "The source side completed but the destination has not settled within the usual window.",
      next_step: "Escalate with the transaction hash so the delay can be traced.",
    }),
    E({
      code: "TXID-7003", cause: "SUCCEEDED_INTENT_UNMET", category: "SETTLEMENT",
      custody: "moved", next_action_owner: "application", retryable: "no", recommended_action: "CONTACT_SUPPORT",
      summary: "The transaction succeeded, but the intended outcome did not happen.",
      detail: "The chain recorded a successful transaction, yet what the user was trying to achieve is not reflected in the result. This needs investigation rather than a retry.",
      next_step: "Escalate with the transaction hash and the intended action.",
    }),
    E({
      code: "TXID-7004", cause: "INDEXER_LAG", category: "SETTLEMENT",
      custody: "unknown", next_action_owner: "none", retryable: "no", recommended_action: "REFRESH_AND_RECHECK",
      summary: "The transaction is confirmed on chain but has not appeared in the data source yet.",
      detail: "Indexers trail the chain by a short interval. The transaction exists; the view of it is behind.",
      next_step: "Check again shortly.",
    }),

    // ── 8xxx OFFCHAIN_PROCESS: waiting on something the chain cannot see ──
    // These require a caller to supply workflow state. The codes exist so the
    // shape is stable the day a Partner integration provides it.
    E({
      code: "TXID-8001", cause: "AWAITING_COMPLIANCE_REVIEW", category: "OFFCHAIN_PROCESS",
      custody: "unchanged", next_action_owner: "application", retryable: "no", recommended_action: "WAIT",
      summary: "The request is waiting on a compliance review.",
      detail: "No on-chain transaction has been created yet, which is why nothing appears on a block explorer. Assets remain where they were.",
      next_step: "No customer action is needed while the review is in progress.",
    }),
    E({
      code: "TXID-8002", cause: "AWAITING_OPERATOR_APPROVAL", category: "OFFCHAIN_PROCESS",
      custody: "unchanged", next_action_owner: "application", retryable: "no", recommended_action: "WAIT",
      summary: "The request is waiting for an internal approval.",
      detail: "The request was received and is queued for approval before anything is submitted on chain.",
      next_step: "No customer action is needed.",
    }),
    E({
      code: "TXID-8003", cause: "OFFCHAIN_HOLD", category: "OFFCHAIN_PROCESS",
      custody: "unchanged", next_action_owner: "application", retryable: "no", recommended_action: "CONTACT_SUPPORT",
      summary: "The request is on hold.",
      detail: "An operational hold is preventing this from progressing on chain.",
      next_step: "Check the hold reason before advising the customer.",
    }),

    // ── 9xxx INDETERMINATE: we will not guess ─────────────────────────────
    E({
      code: "TXID-9001", cause: "UNDECODED_REVERT", category: "INDETERMINATE",
      custody: "unchanged", next_action_owner: "unknown", retryable: "unknown", recommended_action: "CONTACT_SUPPORT",
      summary: "The transaction was rejected, and the reason could not be decoded.",
      detail: "The contract returned data that does not match any known error definition. Uploading the contract's interface usually makes this readable.",
      next_step: "Escalate with the transaction hash.",
    }),
    E({
      code: "TXID-9002", cause: "UNMAPPED_PROTOCOL_ERROR", category: "INDETERMINATE",
      custody: "unchanged", next_action_owner: "unknown", retryable: "unknown", recommended_action: "CONTACT_SUPPORT",
      summary: "The contract rejected the transaction with a code it does not publish a description for.",
      detail: "The condition is identified but its meaning is not documented by the protocol, so no confident explanation is available.",
      next_step: "Escalate with the transaction hash and the reported code.",
    }),
    E({
      code: "TXID-9003", cause: "TRANSACTION_NOT_FOUND", category: "INDETERMINATE",
      custody: "unknown", next_action_owner: "unknown", retryable: "unknown", recommended_action: "REFRESH_AND_RECHECK",
      summary: "No transaction with this identifier could be found.",
      detail: "It may never have been broadcast, may have expired, may be on a different network, or may be older than the node's retention window, in which case a block explorer can still show it.",
      next_step: "Confirm the network, and check a block explorer for the same hash.",
    }),
    E({
      code: "TXID-9004", cause: "INSUFFICIENT_EVIDENCE", category: "INDETERMINATE",
      custody: "unknown", next_action_owner: "unknown", retryable: "unknown", recommended_action: "CONTACT_SUPPORT",
      summary: "There is not enough information to determine what happened.",
      detail: "No conclusion is offered rather than a guess presented as a finding.",
      next_step: "Escalate for investigation.",
    }),
  ].map(e => [e.code, e]),
)

/** Look up a code. Returns undefined for an unknown code rather than throwing. */
export function entry(code: string): RegistryEntry | undefined {
  return REGISTRY[code]
}

/** Every code, for tests, docs generation and Console filters. */
export const ALL_CODES: string[] = Object.keys(REGISTRY)
