/**
 * Why an order did not stand, in Hyperliquid's own words.
 *
 * THIS IS THE WHOLE REASON THE PACKAGE EXISTS. Every other chain we read makes
 * us work backwards from a number: a Move abort code, a Solidity selector, a
 * signed XDR result. Hyperliquid hands us the reason already NAMED, per user,
 * per order, keyless, with no protocol integration to negotiate.
 *
 * Measured on 2026-09-08 across 15,069 orders from 16 live traders:
 *
 *     7173  open                              5130  filled
 *     1559  canceled                            83  triggered
 *      640  minTradeNtlRejected      REJECTED
 *      210  reduceOnlyCanceled       CANCELLED BY THE EXCHANGE
 *      136  reduceOnlyRejected       REJECTED
 *       90  iocCancelRejected        REJECTED
 *       34  badAloPxRejected         REJECTED
 *        6  perpMarginRejected       REJECTED
 *        6  insufficientSpotBalanceRejected  REJECTED
 *        2  rejected                 REJECTED
 *
 * So 1,122 of 15,069 orders, 7.4%, did not stand for a reason the exchange
 * states outright and no support tool surfaces. `minTradeNtlRejected` alone is
 * 640 of them, and it is a plain user mistake with a plain fix.
 *
 * STATUSES ARE ONLY THOSE OBSERVED LIVE, the same rule LayerZero and Sui carry.
 * Hyperliquid's documented vocabulary is larger than this list. A status we
 * have never held a real payload for takes the honest floor: it is named,
 * described as a state we do not have wording for, and never guessed at from
 * the words inside it. Do not add an entry without a captured example.
 */

export type StatusKind =
  /** The order is still working, or did what it was asked to do. */
  | "normal"
  /** The exchange refused the order outright. */
  | "rejected"
  /** The exchange cancelled a resting order, rather than the trader doing so. */
  | "exchange_cancelled"
  /** Observed field, no wording held. */
  | "unknown"

export interface StatusMeaning {
  kind: StatusKind
  /** Plain English. Absent for `unknown`, which is stated rather than invented. */
  reason: string | null
}

const STATUSES: Record<string, StatusMeaning> = {
  // ── Normal lifecycle ──────────────────────────────────────────────────────
  open: { kind: "normal", reason: "The order is still resting on the book, waiting to fill." },
  filled: { kind: "normal", reason: "The order traded." },
  canceled: { kind: "normal", reason: "The order was cancelled. On Hyperliquid this is the trader's own cancellation, so if the user did not cancel it, an app or a bot acting for them did." },
  triggered: { kind: "normal", reason: "A stop or take-profit condition was met, so the order was released onto the book." },

  // ── Rejections, which is what people are asking about ─────────────────────
  minTradeNtlRejected: {
    kind: "rejected",
    reason: "The order was below Hyperliquid's minimum trade value. Every market has a floor in dollars rather than in coins, so a small order in a high-priced asset can be under it even when the quantity looks reasonable. Nothing was traded and nothing was charged.",
  },
  reduceOnlyRejected: {
    kind: "rejected",
    reason: "The order was marked reduce-only, and there was no position left for it to reduce. That usually means the position had already been closed, or another order closed it first. Nothing was traded.",
  },
  iocCancelRejected: {
    kind: "rejected",
    reason: "The order was immediate-or-cancel, and there was nothing on the book to fill it at that price, so it was cancelled instead of resting. That is what immediate-or-cancel asks for: fill now or not at all. Nothing was traded.",
  },
  badAloPxRejected: {
    kind: "rejected",
    reason: "The order was add-liquidity-only, and its price would have crossed the book and taken liquidity instead of adding it. Add-liquidity-only exists to guarantee the maker fee, so rather than filling at taker terms the order is refused. The market moved between the price being chosen and the order arriving.",
  },
  perpMarginRejected: {
    kind: "rejected",
    reason: "There was not enough margin for this perpetual order. Margin is the collateral the position needs, not the account balance, so an account can hold funds and still be unable to open more.",
  },
  insufficientSpotBalanceRejected: {
    kind: "rejected",
    reason: "There was not enough of the spot asset to place this order. Spot and perpetual balances are held separately on Hyperliquid, so funds sitting on the perpetuals side do not back a spot order until they are transferred.",
  },
  rejected: {
    kind: "rejected",
    reason: "The exchange refused the order without naming a more specific reason. Nothing was traded.",
  },

  // ── Cancelled BY the exchange, which is not the same as the trader doing it
  reduceOnlyCanceled: {
    kind: "exchange_cancelled",
    reason: "The exchange cancelled this resting reduce-only order because the position it was there to reduce is gone. The trader did not cancel it. Nothing was traded.",
  },
}

/**
 * What a status means, or an honest floor.
 *
 * `unknown` is a REAL outcome and must reach the user as one. Reading meaning
 * out of the words inside an unseen status is exactly how a plausible sentence
 * becomes a wrong one: "reduceOnlyCanceled" and "reduceOnlyRejected" differ by
 * who cancelled the order, which is not recoverable from the name.
 */
export function explainStatus(status: string): StatusMeaning {
  return STATUSES[status] ?? { kind: "unknown", reason: null }
}

/** True when the order did not stand for a reason the exchange states. */
export function isFailure(status: string): boolean {
  const k = explainStatus(status).kind
  return k === "rejected" || k === "exchange_cancelled"
}

/** Every status we hold wording for, so a test can check it against what is observed. */
export const KNOWN_STATUSES = Object.keys(STATUSES)
