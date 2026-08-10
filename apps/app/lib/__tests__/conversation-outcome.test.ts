import { describe, it, expect } from "vitest"
import { conversationOutcome, OUTCOME_META } from "../conversation-outcome"

const NOW = 1_754_600_000_000
const at = (msAgo: number) => new Date(NOW - msAgo).toISOString()

const turn = (n: number) =>
  Array.from({ length: n }).flatMap((_, i) => [
    { role: "user", created_at: at((n - i) * 60_000) },
    { role: "assistant", created_at: at((n - i) * 60_000 - 1_000) },
  ])

describe("conversationOutcome", () => {
  it("says nothing about a normal answered conversation", () => {
    expect(conversationOutcome({ messages: turn(3), sessionCap: 10, now: NOW })).toBe("answered")
    // And an answered conversation gets NO badge, so the list stays scannable.
    expect(OUTCOME_META.answered).toBeNull()
  })

  it("names the message limit, which reads as a stopped conversation otherwise", () => {
    // Ten user turns against a cap of ten. The assistant handed over; the
    // conversation did not simply end.
    expect(conversationOutcome({ messages: turn(10), sessionCap: 10, now: NOW })).toBe("capped")
  })

  it("puts the cap ahead of everything else, because it explains the ending", () => {
    const messages = [...turn(10)]
    messages[1] = { ...messages[1]!, feedback: -1 } as never
    expect(conversationOutcome({ messages, sessionCap: 10, now: NOW })).toBe("capped")
  })

  it("does not claim a cap when none applies", () => {
    expect(conversationOutcome({ messages: turn(10), now: NOW })).toBe("answered")
    expect(conversationOutcome({ messages: turn(10), sessionCap: 0, now: NOW })).toBe("answered")
  })

  it("reports a thumbs down over a plain answer", () => {
    const messages = [...turn(2)]
    messages[1] = { ...messages[1]!, feedback: -1 } as never
    expect(conversationOutcome({ messages, sessionCap: 20, now: NOW })).toBe("unhelpful")
  })

  it("only calls a question unanswered once a reply cannot still be coming", () => {
    const pending = [...turn(1), { role: "user", created_at: at(5_000) }]
    expect(conversationOutcome({ messages: pending, sessionCap: 20, now: NOW })).toBe("in_progress")

    const stale = [...turn(1), { role: "user", created_at: at(10 * 60_000) }]
    expect(conversationOutcome({ messages: stale, sessionCap: 20, now: NOW })).toBe("unanswered")
  })

  it("never returns a resolution claim", () => {
    // We cannot tell a satisfied user from one who gave up: the records are
    // identical. This asserts the omission on purpose, so reintroducing
    // "resolved" as an inference has to be a deliberate act.
    const outcomes = Object.keys(OUTCOME_META)
    expect(outcomes).not.toContain("resolved")
    expect(outcomes).not.toContain("dropped_off")
  })

  it("handles an empty conversation without inventing a failure", () => {
    expect(conversationOutcome({ messages: [], sessionCap: 10, now: NOW })).toBe("answered")
  })
})
