import type { StatusKind } from "./statuses"

export interface HyperliquidPosition {
  coin: string
  /** Signed size. NEGATIVE IS SHORT, and getting that backwards inverts the answer. */
  size: string
  direction: "long" | "short"
  entryPrice: string | null
  positionValue: string | null
  unrealizedPnl: string | null
  liquidationPrice: string | null
  leverage: string | null
}

export interface HyperliquidAccount {
  address: string
  /** Total account value in USD, as the exchange states it. */
  accountValue: string | null
  /** What can be withdrawn right now, which is not the same as the balance. */
  withdrawable: string | null
  totalMarginUsed: string | null
  positions: HyperliquidPosition[]
  /** Spot balances, held SEPARATELY from perpetual collateral on Hyperliquid. */
  spot: { coin: string; total: string }[]
  /** True when this address has no HyperCore account at all, which is a real answer. */
  neverTraded: boolean
}

export interface HyperliquidOrder {
  coin: string
  side: "buy" | "sell"
  size: string
  originalSize: string
  limitPrice: string | null
  orderType: string | null
  /** "Ioc", "Alo", "Gtc"… Load-bearing: it decides whether a rejection was expected. */
  timeInForce: string | null
  reduceOnly: boolean
  orderId: number | null
  placedAt: string | null
  age: string | null
  /** Hyperliquid's own status, verbatim. */
  status: string
  statusKind: StatusKind
  /** Plain English, or null when we hold no wording for this status. */
  reason: string | null
  statusAt: string | null
}

export interface HyperliquidFill {
  coin: string
  side: "buy" | "sell"
  price: string
  size: string
  /** "Close Long", "Open Short"… the exchange's own description. */
  direction: string | null
  closedPnl: string | null
  fee: string | null
  hash: string | null
  filledAt: string | null
  age: string | null
}

/**
 * Three outcomes, never two. `not_found` is a FINDING (the exchange answered and
 * has nothing for this address); `unavailable` is not. Collapsing them is how an
 * outage reaches a user as "you have never traded here".
 */
export type HyperliquidLookup<T> =
  | { kind: "ok"; value: T }
  | { kind: "not_found" }
  | { kind: "unavailable"; reason: string }
