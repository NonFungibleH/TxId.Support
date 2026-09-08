import { describe, it, expect } from "vitest"
import { KNOWN_STATUSES, explainStatus, isFailure } from "./statuses"

/**
 * Every status here was OBSERVED, across 15,069 orders from 16 live traders on
 * 2026-09-08. 1,122 of those orders, 7.4%, did not stand for a reason the
 * exchange states outright and no support tool surfaces. That is the product.
 */
const OBSERVED_COUNTS: Record<string, number> = {
  open: 7173, filled: 5130, canceled: 1559, minTradeNtlRejected: 640,
  reduceOnlyCanceled: 210, reduceOnlyRejected: 136, iocCancelRejected: 90,
  triggered: 83, badAloPxRejected: 34, perpMarginRejected: 6,
  insufficientSpotBalanceRejected: 6, rejected: 2,
}

describe("the status vocabulary is what we saw, not what we imagined", () => {
  it("holds wording for every status observed live", () => {
    const missing = Object.keys(OBSERVED_COUNTS).filter(s => explainStatus(s).kind === "unknown")
    expect(missing).toEqual([])
  })

  it("holds wording for nothing we did not observe", () => {
    // The rule LayerZero and Sui carry: no branch without a captured example.
    // Hyperliquid documents more statuses than this; inventing wording for one
    // we have never held a payload for is how a plausible sentence becomes a
    // wrong one.
    const invented = KNOWN_STATUSES.filter(s => !(s in OBSERVED_COUNTS))
    expect(invented).toEqual([])
  })

  // reduceOnlyCanceled and reduceOnlyRejected differ by WHO ended the order,
  // which is not recoverable from the name. That is precisely why an unseen
  // status is never guessed at.
  it("keeps a rejection apart from an exchange cancellation", () => {
    expect(explainStatus("reduceOnlyRejected").kind).toBe("rejected")
    expect(explainStatus("reduceOnlyCanceled").kind).toBe("exchange_cancelled")
    expect(explainStatus("reduceOnlyCanceled").reason).toMatch(/The trader did not cancel it/)
  })

  it("does not treat a trader's own cancellation as a failure", () => {
    expect(isFailure("canceled")).toBe(false)
    expect(isFailure("open")).toBe(false)
    expect(isFailure("filled")).toBe(false)
    expect(isFailure("triggered")).toBe(false)
  })

  it("treats every rejection and exchange cancellation as a failure", () => {
    for (const s of ["minTradeNtlRejected", "reduceOnlyRejected", "iocCancelRejected",
                     "badAloPxRejected", "perpMarginRejected", "insufficientSpotBalanceRejected",
                     "rejected", "reduceOnlyCanceled"]) {
      expect(isFailure(s), s).toBe(true)
    }
  })

  it("takes an honest floor for anything unseen, and never guesses from the name", () => {
    const u = explainStatus("someFutureThingRejected")
    expect(u.kind).toBe("unknown")
    expect(u.reason).toBeNull()
    // "Rejected" in the name must NOT be enough to classify it as a failure,
    // because that is reading meaning out of a string we have never seen.
    expect(isFailure("someFutureThingRejected")).toBe(false)
  })
})

describe("the explanations say what a user needs and nothing they cannot act on", () => {
  const all = KNOWN_STATUSES.map(s => explainStatus(s).reason!).filter(Boolean)

  it("uses no em dashes", () => {
    expect(all.filter(t => /[—–]/.test(t))).toEqual([])
  })

  it("never offers advice or reassurance about funds", () => {
    const banned = /\b(you should (buy|sell|close|hold)|your funds are safe|don't worry|guaranteed)\b/i
    expect(all.filter(t => banned.test(t))).toEqual([])
  })

  // The biggest single rejection by a wide margin, and it is a plain user
  // mistake, so the wording has to name the thing that is actually the limit.
  it("explains the minimum trade value in dollars, not in coins", () => {
    const r = explainStatus("minTradeNtlRejected").reason!
    expect(r).toMatch(/in dollars rather than in coins/)
  })

  // Spot and perpetual collateral are held separately, which is the part a user
  // gets wrong when they can see a balance and still cannot place an order.
  it("names the spot and perpetual split where it is the cause", () => {
    expect(explainStatus("insufficientSpotBalanceRejected").reason).toMatch(/held separately/)
    expect(explainStatus("perpMarginRejected").reason).toMatch(/collateral the position needs, not the account balance/)
  })
})
