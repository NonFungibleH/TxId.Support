/**
 * LayerZero is a MESSAGE LAYER, not a chain. A user's funds leave one chain in
 * one transaction and arrive on another in a second transaction that they did
 * not send and cannot see. Between the two, every existing tool tells them the
 * same useless thing: the source transaction SUCCEEDED.
 *
 * That gap is the worst support case in DeFi. "It says it worked and my money
 * isn't there" is where people conclude they have been robbed, and where they
 * do the one thing that actually loses money: send it again.
 */

/** Statuses observed live on 2026-09-07 across 100 recent messages. */
export type LzLegStatus = "SUCCEEDED" | "WAITING" | "VALIDATING_TX" | string

export interface LzLeg {
  /** Human chain name as LayerZero reports it ("arbitrum", "ethereum"). */
  chain: string | null
  status: LzLegStatus
  txHash: string | null
  blockTimestamp: number | null
}

export interface LayerZeroMessage {
  guid: string | null
  /** The app that sent it: "Stargate", "USDT0", "PayPal". Null when unknown. */
  app: string | null
  sender: string | null
  receiver: string | null
  source: LzLeg
  destination: LzLeg
}

/**
 * Three outcomes, never two. A 404 is a FINDING (this transaction carries no
 * LayerZero message); a network failure is not. Collapsing them would let an
 * outage tell a user their bridge transfer does not exist, which is the single
 * most frightening thing we could say to someone whose funds are in flight.
 */
export type LzLookup =
  | { kind: "ok"; messages: LayerZeroMessage[] }
  | { kind: "not_found" }
  | { kind: "unavailable"; reason: string }

/** Mirrors apps/app lib/resolution/types.ts. Kept as literals so this package
 *  stays dependency-free; the shapes are asserted in explain.test.ts. */
export type LzCustody = "unchanged" | "moved" | "partial" | "unknown"
export type LzOwner = "user" | "application" | "protocol" | "infrastructure" | "none" | "unknown"
export type LzRetryable = "yes" | "after_change" | "no" | "unknown"
export type LzStatus = "pending" | "failed" | "succeeded" | "indeterminate"

export interface LzExplanation {
  status: LzStatus
  custody: LzCustody
  retryable: LzRetryable
  nextActionOwner: LzOwner
  /** One sentence, written to be read to a frightened user. */
  headline: string
  /** What to do, or explicitly what not to do. */
  recommendedAction: string
  /** True when we did not recognise the status and said so rather than guessing. */
  unrecognised: boolean
}
