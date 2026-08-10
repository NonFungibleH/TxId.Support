import { describe, it, expect } from "vitest"
import { findingKindOf, BUG_OPENER, FEEDBACK_OPENER } from "../finding-openers"

/**
 * The dashboard labels a thread by reading back the opener the widget sent.
 * These two constants are therefore a contract between two apps, and the tests
 * exist so changing the wording in one of them fails here rather than silently
 * unlabelling every thread.
 */
describe("findingKindOf", () => {
  const reply = { role: "assistant", content: "Got it." }

  it("labels a thread by its opener", () => {
    expect(findingKindOf([{ role: "user", content: BUG_OPENER }, reply])).toBe("bug")
    expect(findingKindOf([{ role: "user", content: FEEDBACK_OPENER }, reply])).toBe("feedback")
  })

  it("leaves an ordinary support thread unlabelled", () => {
    expect(findingKindOf([{ role: "user", content: "why did my swap fail?" }, reply])).toBeNull()
  })

  it("reads the FIRST user message, not any later one", () => {
    // Someone who files a bug and then asks a question is having a support
    // conversation that began with a report. Labelling on any match would make
    // the badge unreliable exactly where it matters.
    const thread = [
      { role: "user", content: "why did my swap fail?" },
      reply,
      { role: "user", content: BUG_OPENER },
    ]
    expect(findingKindOf(thread)).toBeNull()
  })

  it("ignores a leading assistant greeting", () => {
    const thread = [
      { role: "assistant", content: "Hi! I'm here to help." },
      { role: "user", content: BUG_OPENER },
    ]
    expect(findingKindOf(thread)).toBe("bug")
  })

  it("tolerates whitespace, and an empty thread", () => {
    expect(findingKindOf([{ role: "user", content: `  ${BUG_OPENER}  ` }])).toBe("bug")
    expect(findingKindOf([])).toBeNull()
  })
})
