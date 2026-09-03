import { describe, expect, it } from "vitest"
import { relativeAge } from "./fullnode"

/**
 * The observed failure, pinned. Asked "what was my last trade" at 15:19:06
 * UTC, the assistant reported a fill that really was at 14:09:47 UTC as
 * "about 9 minutes ago": it compared the minute fields (09 against 19) and
 * dropped the hour. The trade details were correct, which made the wrong
 * number more credible, not less.
 */
describe("relativeAge", () => {
  const now = Date.parse("2026-09-03T15:19:06Z")

  it("does not drop the hour (the live bug)", () => {
    const out = relativeAge("2026-09-03T14:09:47Z", now)
    expect(out).toBe("1 hour 9 minutes ago")
    expect(out).not.toBe("9 minutes ago")
    expect(out?.startsWith("9 minute")).toBe(false)
  })

  it("says just now under a minute", () => {
    expect(relativeAge("2026-09-03T15:18:30Z", now)).toBe("just now")
  })

  it("uses minutes under an hour", () => {
    expect(relativeAge("2026-09-03T14:40:06Z", now)).toBe("39 minutes ago")
    expect(relativeAge("2026-09-03T15:18:00Z", now)).toBe("1 minute ago")
  })

  it("omits a zero minute remainder", () => {
    expect(relativeAge("2026-09-03T13:19:06Z", now)).toBe("2 hours ago")
  })

  it("switches to days past 24 hours", () => {
    expect(relativeAge("2026-09-02T10:00:00Z", now)).toBe("1 day ago")
    expect(relativeAge("2026-08-30T10:00:00Z", now)).toBe("4 days ago")
  })

  it("labels a clock-skewed future stamp instead of going negative", () => {
    const out = relativeAge("2026-09-03T15:25:06Z", now)
    expect(out).toBe("in 6 minutes")
    expect(out).not.toContain("-")
  })

  it("returns null for an unparseable timestamp, never a guess", () => {
    expect(relativeAge("", now)).toBeNull()
    expect(relativeAge("not a date", now)).toBeNull()
  })
})
