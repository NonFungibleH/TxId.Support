import { describe, it, expect } from "vitest"
import {
  assignArm,
  classifyWallet,
  summarizeCohort,
  ACTIVATION_WINDOW_DAYS,
  MIN_KNOWN_PER_ARM,
  type CohortRow,
  type ProtocolHistory,
} from "@/lib/activation/cohort"

const DAY = 86_400_000
const T0 = Date.parse("2026-09-01T12:00:00Z")
const iso = (ms: number) => new Date(ms).toISOString()

describe("holdout arm", () => {
  it("is deterministic per project and wallet, and ignores address case", () => {
    const a = assignArm("p1", "0xAbC0000000000000000000000000000000000001", 10)
    expect(assignArm("p1", "0xabc0000000000000000000000000000000000001", 10)).toBe(a)
  })

  it("holds out nobody at 0 and roughly the configured share otherwise", () => {
    const wallets = Array.from({ length: 5000 }, (_, i) => `0x${i.toString(16).padStart(40, "0")}`)
    expect(wallets.every(w => assignArm("p1", w, 0) === "shown")).toBe(true)
    const held = wallets.filter(w => assignArm("p1", w, 10) === "holdout").length / wallets.length
    expect(held).toBeGreaterThan(0.08)
    expect(held).toBeLessThan(0.12)
  })

  it("clamps an out-of-range share instead of holding out everyone", () => {
    const wallets = Array.from({ length: 2000 }, (_, i) => `0x${i.toString(16).padStart(40, "0")}`)
    const held = wallets.filter(w => assignArm("p1", w, 400) === "holdout").length / wallets.length
    expect(held).toBeLessThan(0.55)
  })
})

describe("classifying a wallet from its history", () => {
  const firstSeen = iso(T0)
  const pending: Pick<CohortRow, "status" | "first_seen_at" | "activated_at"> = { status: "pending", first_seen_at: firstSeen, activated_at: null }
  const now = T0 + 2 * DAY

  const history = (txs: { at: number; success: boolean; hash?: string }[], complete: boolean, oldest?: number): ProtocolHistory => ({
    kind: "ok",
    complete,
    oldestAt: oldest !== undefined ? iso(oldest) : txs.length ? iso(Math.min(...txs.map(t => t.at))) : null,
    txs: txs.map((t, i) => ({ hash: t.hash ?? `0x${i}`, at: iso(t.at), success: t.success })),
  })

  // ABSENCE IS NOT A FINDING: a lookup that did not complete changes nothing.
  it("changes nothing when the read failed", () => {
    expect(classifyWallet(pending, { kind: "unavailable" }, now)).toEqual({})
  })

  it("marks a wallet that had already used the protocol as existing, even from a partial read", () => {
    const u = classifyWallet(pending, history([{ at: T0 - 30 * DAY, success: true }], false), now)
    expect(u.status).toBe("existing")
  })

  it("does not call a wallet new from a partial history", () => {
    const u = classifyWallet(pending, history([], false, T0 - DAY), now)
    expect(u.status).toBeUndefined()
  })

  it("calls a wallet new only from a complete history with no earlier success", () => {
    const u = classifyWallet(pending, history([{ at: T0 - DAY, success: false }], true), now)
    expect(u.status).toBe("new")
    expect(u.last_checked_at).toBe(iso(now))
  })

  it("records the first success after first seen as the activation", () => {
    const row = { ...pending, status: "new" as const }
    const u = classifyWallet(row, history([
      { at: T0 + 3 * 3_600_000, success: true, hash: "0xsecond" },
      { at: T0 + 2 * 3_600_000, success: true, hash: "0xfirst" },
      { at: T0 + 1 * 3_600_000, success: false },
    ], true), now)
    expect(u.activated_at).toBe(iso(T0 + 2 * 3_600_000))
    expect(u.activation_tx).toBe("0xfirst")
  })

  it("does not record an activation for a wallet whose newness is unproven", () => {
    const u = classifyWallet(pending, history([{ at: T0 + DAY, success: true }], false, T0 + DAY), now)
    expect(u.activated_at).toBeUndefined()
  })

  it("keeps an activation once recorded", () => {
    const row = { status: "new" as const, first_seen_at: firstSeen, activated_at: iso(T0 + DAY) }
    const u = classifyWallet(row, history([{ at: T0 + 1.5 * DAY, success: true }], true), now)
    expect(u.activated_at).toBeUndefined()
  })

  it("only stamps a check that covered the whole window since first seen", () => {
    const row = { ...pending, status: "new" as const }
    // 100 transactions since first seen, none reaching back to it: not covered.
    expect(classifyWallet(row, history([], false, T0 + DAY), now).last_checked_at).toBeUndefined()
    // Reaches back past first seen: covered, even though it is not the full history.
    expect(classifyWallet(row, history([], false, T0 - DAY), now).last_checked_at).toBe(iso(now))
  })
})

describe("cohort summary", () => {
  const now = T0 + 40 * DAY
  let n = 0
  const row = (over: Partial<CohortRow>): CohortRow => ({
    wallet_address: `0x${(n++).toString(16)}`,
    arm: "shown",
    status: "new",
    first_seen_at: iso(T0),
    activated_at: null,
    last_checked_at: iso(T0 + (ACTIVATION_WINDOW_DAYS + 1) * DAY),
    prompted_at: null,
    opened_at: null,
    dismissed_at: null,
    ...over,
  })

  it("leaves out existing and pending wallets, and counts them separately", () => {
    const s = summarizeCohort([row({ status: "existing" }), row({ status: "pending" }), row({})], now)
    expect(s.excluded).toEqual({ existing: 1, pending: 1 })
    expect(s.shown.wallets).toBe(1)
  })

  it("never counts an unconfirmed wallet as not activated", () => {
    const s = summarizeCohort([
      row({ last_checked_at: iso(T0 + 3 * DAY) }), // window over, never checked after it closed
      row({}), // checked after the window: a known non-activation
    ], now)
    expect(s.shown.unconfirmed).toBe(1)
    expect(s.shown.notActivated).toBe(1)
  })

  it("counts a wallet still inside its window as in progress", () => {
    const s = summarizeCohort([row({ first_seen_at: iso(now - DAY), last_checked_at: null })], now)
    expect(s.shown.inProgress).toBe(1)
  })

  it("counts an activation after the window as not activated within it", () => {
    const s = summarizeCohort([row({ activated_at: iso(T0 + (ACTIVATION_WINDOW_DAYS + 2) * DAY) })], now)
    expect(s.shown.activated).toBe(0)
    expect(s.shown.notActivated).toBe(1)
  })

  it("refuses to compare until both groups have enough known outcomes", () => {
    const few = [
      ...Array.from({ length: 50 }, () => row({ activated_at: iso(T0 + DAY) })),
      ...Array.from({ length: MIN_KNOWN_PER_ARM - 1 }, () => row({ arm: "holdout" })),
    ]
    const s = summarizeCohort(few, now)
    expect(s.comparable).toBe(false)
    expect(s.difference).toBeNull()
    expect(s.holdout.rate).toBeNull()
  })

  it("compares the two groups with an interval once there is enough", () => {
    const rows = [
      ...Array.from({ length: 60 }, () => row({ activated_at: iso(T0 + DAY) })),
      ...Array.from({ length: 40 }, () => row({})),
      ...Array.from({ length: 30 }, () => row({ arm: "holdout", activated_at: iso(T0 + DAY) })),
      ...Array.from({ length: 70 }, () => row({ arm: "holdout" })),
    ]
    const s = summarizeCohort(rows, now)
    expect(s.shown.rate).toBeCloseTo(0.6)
    expect(s.holdout.rate).toBeCloseTo(0.3)
    expect(s.comparable).toBe(true)
    expect(s.difference!.points).toBeCloseTo(30)
    expect(s.difference!.low).toBeGreaterThan(0)
    expect(s.difference!.high).toBeGreaterThan(s.difference!.points)
  })

  it("counts the funnel for the group that saw it", () => {
    const s = summarizeCohort([
      row({ prompted_at: iso(T0), opened_at: iso(T0) }),
      row({ prompted_at: iso(T0), dismissed_at: iso(T0) }),
      row({ arm: "holdout" }),
    ], now)
    expect(s.funnel).toEqual({ prompted: 2, opened: 1, dismissed: 1 })
  })
})
