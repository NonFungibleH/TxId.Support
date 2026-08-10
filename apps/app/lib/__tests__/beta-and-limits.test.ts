import { describe, expect, it } from "vitest"
import { activeBeta, betaControls, PLAN_SESSION_MESSAGE_LIMITS } from "../types/config"

describe("activeBeta", () => {
  it("null config means no programme", () => {
    expect(activeBeta(null)).toBeNull()
    expect(activeBeta(undefined)).toBeNull()
    expect(activeBeta({})).toBeNull()
  })

  it("disabled means no programme regardless of other fields", () => {
    expect(activeBeta({ beta: { enabled: false, autoOpen: true, feedback: true } })).toBeNull()
  })

  it("an enabled programme with no end date runs", () => {
    const beta = { enabled: true, autoOpen: true, feedback: true }
    expect(activeBeta({ beta })).toEqual(beta)
  })

  it("expiry resolves ON READ: a passed end date ends the programme with no job involved", () => {
    const beta = { enabled: true, endsAt: new Date(Date.now() - 60_000).toISOString() }
    expect(activeBeta({ beta })).toBeNull()
  })

  it("a future end date keeps it running", () => {
    const beta = { enabled: true, endsAt: new Date(Date.now() + 86_400_000).toISOString() }
    expect(activeBeta({ beta })).toEqual(beta)
  })

  it("an unparseable end date fails towards RUNNING, never towards silently off", () => {
    const beta = { enabled: true, endsAt: "not-a-date" }
    expect(activeBeta({ beta })).toEqual(beta)
  })
})

describe("plan session caps", () => {
  it("the demo plan is never sized for anonymous traffic", () => {
    // REGRESSION PIN for the 2026-08-07 incident: flipping a pilot customer to
    // the hand-provisioned demo plan silently attached the PUBLIC demo key's
    // 8-message session cap, which would have cut off a beta tester on their
    // ninth message mid-pilot. The route now keys the hard cap on public
    // surfaces only, and this table entry must stay pilot-sized.
    expect(PLAN_SESSION_MESSAGE_LIMITS.demo).toBeGreaterThanOrEqual(40)
  })
})

describe("betaControls", () => {
  it("a project configured before the split keeps both controls", () => {
    // The inherit rule is the whole point: bug reports were added after
    // projects were already running with feedback on, and those testers must
    // not lose a button because a field did not exist yet.
    expect(betaControls({ feedback: true })).toEqual({ feedback: true, bugs: true, any: true })
  })

  it("each switch stands on its own once set", () => {
    expect(betaControls({ feedback: true, bugReports: false }))
      .toEqual({ feedback: true, bugs: false, any: true })
    expect(betaControls({ feedback: false, bugReports: true }))
      .toEqual({ feedback: false, bugs: true, any: true })
  })

  it("neither on means no mode row at all", () => {
    expect(betaControls({ feedback: false }).any).toBe(false)
    expect(betaControls(null).any).toBe(false)
    expect(betaControls(undefined).any).toBe(false)
  })
})
