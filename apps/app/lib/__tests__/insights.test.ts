import { describe, expect, it } from "vitest"
import { computeInsights, SMALL_SAMPLE } from "../insights"
import type { InsightWindow, WindowMessage } from "../insights"

/**
 * These cover the rules a reader would be misled by if they were wrong: which
 * question a failed search is attributed to, which screen a bug is blamed on,
 * and the refusal to publish a rate off a handful of conversations.
 */

const OLD = "2026-08-01T10:00:00.000Z"

function conv(id: string, extra: Partial<InsightWindow["conversations"][number]> = {}) {
  return { id, created_at: OLD, summary: null, category: null, sentiment: null, ...extra }
}

function msg(
  conversation_id: string,
  role: string,
  content: string | null,
  at: string,
  evidence: WindowMessage["evidence"] = null,
  feedback: number | null = null,
): WindowMessage {
  return { conversation_id, role, content, created_at: at, feedback, evidence }
}

const win = (w: Partial<InsightWindow>): InsightWindow => ({
  conversations: [], messages: [], tickets: [], truncated: false, ...w,
})

describe("computeInsights: documentation gaps", () => {
  it("attributes a failed search to the question it answered, not the newest one", () => {
    // The gap list is a work list for a docs owner. An entry showing the wrong
    // question sends them to write the wrong page, which is worse than no entry.
    const messages = [
      msg("c1", "user", "how do fees work?", "2026-08-01T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg("c1", "assistant", "Fees are…", "2026-08-01T10:00:01Z", { retrieval: { matched: 3, topScore: 0.8 } } as any),
      msg("c1", "user", "and how do I withdraw?", "2026-08-01T10:00:02Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg("c1", "assistant", "I am not sure.", "2026-08-01T10:00:03Z", { retrieval: { matched: 0 } } as any),
    ]
    const out = computeInsights(win({ conversations: [conv("c1")], messages }), 30)

    expect(out.docGaps).toHaveLength(1)
    expect(out.docGaps[0]!.question).toBe("and how do I withdraw?")
    expect(out.docGaps[0]!.kind).toBe("none")
  })

  it("ranks nothing-matched above matched-but-weak", () => {
    const messages = [
      msg("c1", "user", "weak question here", "2026-08-02T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg("c1", "assistant", "…", "2026-08-02T10:00:01Z", { retrieval: { matched: 2, topScore: 0.4 } } as any),
      msg("c2", "user", "missing question here", "2026-08-01T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg("c2", "assistant", "…", "2026-08-01T10:00:01Z", { retrieval: { matched: 0 } } as any),
    ]
    const out = computeInsights(
      win({ conversations: [conv("c1"), conv("c2")], messages }), 30,
    )
    // Despite c2 being older, an absent page is the clearer instruction.
    expect(out.docGaps.map(g => g.kind)).toEqual(["none", "weak"])
  })

  it("a canned Bug / Feedback opener is not a documentation gap", () => {
    // The Bug button injects "I want to report a bug." and the reply matches no
    // docs by nature. Without the filter it tops the list in every bug thread,
    // telling a docs owner nothing they can act on.
    const messages = [
      msg("c1", "user", "I want to report a bug.", "2026-08-01T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg("c1", "assistant", "What went wrong?", "2026-08-01T10:00:01Z", { retrieval: { matched: 0 } } as any),
    ]
    const out = computeInsights(win({ conversations: [conv("c1")], messages }), 30)
    expect(out.docGaps).toHaveLength(0)
    expect(out.docGapCounts.none).toBe(0)
  })

  it("a good search is not a gap, and an answer with no question above it is dropped", () => {
    const messages = [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg("c1", "assistant", "unprompted", "2026-08-01T10:00:00Z", { retrieval: { matched: 0 } } as any),
      msg("c2", "user", "covered question", "2026-08-01T10:00:00Z"),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      msg("c2", "assistant", "…", "2026-08-01T10:00:01Z", { retrieval: { matched: 5, topScore: 0.9 } } as any),
    ]
    const out = computeInsights(win({ conversations: [conv("c1"), conv("c2")], messages }), 30)
    expect(out.docGaps).toHaveLength(0)
  })
})

describe("computeInsights: findings by screen", () => {
  const pageEvidence = (url: string) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ({ request: { pageUrl: url } }) as any

  it("counts bugs and feedback separately against the page they happened on", () => {
    const out = computeInsights(win({
      conversations: [conv("c1"), conv("c2")],
      messages: [
        msg("c1", "assistant", "…", "2026-08-01T10:00:00Z", pageEvidence("https://app.yamata.pm/portfolio")),
        msg("c2", "assistant", "…", "2026-08-01T10:00:00Z", pageEvidence("https://app.yamata.pm/portfolio")),
      ],
      tickets: [
        { id: "t1", ref: "TKT-1", conversation_id: "c1", reason: "bug", created_at: OLD },
        { id: "t2", ref: "TKT-2", conversation_id: "c2", reason: "feedback", created_at: OLD },
      ],
    }), 30)

    expect(out.screens).toEqual([
      { url: "https://app.yamata.pm/portfolio", bugs: 1, feedback: 1, conversations: 2 },
    ])
  })

  it("uses the FIRST page recorded, because that is where they hit it", () => {
    // A tester navigates while typing. Blaming the page they happened to be on
    // when they finished describing the problem sends the team to the wrong one.
    const out = computeInsights(win({
      conversations: [conv("c1")],
      messages: [
        msg("c1", "assistant", "…", "2026-08-01T10:00:00Z", pageEvidence("https://app.yamata.pm/trade")),
        msg("c1", "assistant", "…", "2026-08-01T10:00:09Z", pageEvidence("https://app.yamata.pm/help")),
      ],
      tickets: [{ id: "t1", ref: "TKT-1", conversation_id: "c1", reason: "bug", created_at: OLD }],
    }), 30)

    expect(out.screens[0]!.url).toBe("https://app.yamata.pm/trade")
  })

  it("counts findings with no recorded page rather than hiding them", () => {
    // Silently dropping them would make the ranked list look complete when it
    // is not, which is the failure mode of every "top pages" report.
    const out = computeInsights(win({
      conversations: [conv("c1")],
      messages: [msg("c1", "assistant", "…", "2026-08-01T10:00:00Z")],
      tickets: [{ id: "t1", ref: "TKT-1", conversation_id: "c1", reason: "bug", created_at: OLD }],
    }), 30)

    expect(out.screens).toHaveLength(0)
    expect(out.screensUnknown).toBe(1)
  })

  it("ignores ordinary support tickets: they are not findings", () => {
    const out = computeInsights(win({
      conversations: [conv("c1")],
      messages: [msg("c1", "assistant", "…", "2026-08-01T10:00:00Z", pageEvidence("https://app.yamata.pm/x"))],
      tickets: [{ id: "t1", ref: "TKT-1", conversation_id: "c1", reason: "failed_transaction", created_at: OLD }],
    }), 30)

    expect(out.screens).toHaveLength(0)
    expect(out.screensUnknown).toBe(0)
  })
})

describe("computeInsights: outcomes and basis", () => {
  it("counts outcomes, drops empty buckets, and puts the worst first", () => {
    const out = computeInsights(win({
      conversations: [conv("c1"), conv("c2")],
      messages: [
        // c1: ends on the user, long ago = unanswered.
        msg("c1", "user", "hello?", OLD),
        // c2: answered.
        msg("c2", "user", "hi", OLD),
        msg("c2", "assistant", "hello", "2026-08-01T10:00:01Z"),
      ],
    }), 30)

    expect(out.outcomes).toEqual([
      { outcome: "unanswered", count: 1 },
      { outcome: "answered", count: 1 },
    ])
  })

  it("takes the WORST basis per conversation, never an average", () => {
    const out = computeInsights(win({
      conversations: [conv("c1")],
      messages: [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        msg("c1", "assistant", "…", "2026-08-01T10:00:00Z", { grounding: "verified" } as any),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        msg("c1", "assistant", "…", "2026-08-01T10:00:01Z", { grounding: "ungrounded" } as any),
      ],
    }), 30)

    expect(out.basis).toEqual([{ basis: "unverified", count: 1 }])
  })
})

describe("computeInsights: honesty about sample size", () => {
  it("flags a small sample, which is every beta", () => {
    const out = computeInsights(win({ conversations: [conv("c1")] }), 30)
    expect(out.smallSample).toBe(true)
    expect(SMALL_SAMPLE).toBeGreaterThan(1)
  })

  it("stops flagging once there is enough to say anything proportional", () => {
    const conversations = Array.from({ length: SMALL_SAMPLE }, (_, i) => conv(`c${i}`))
    expect(computeInsights(win({ conversations }), 30).smallSample).toBe(false)
  })

  it("empty is empty, not a page of zeroes", () => {
    const out = computeInsights(win({}), 30)
    expect(out.conversations).toBe(0)
    expect(out.outcomes).toEqual([])
    expect(out.themes).toEqual([])
  })
})

describe("computeInsights: doc-gap counts are true totals, not the capped list", () => {
  it("counts every gap even when the displayed list is capped at 25", () => {
    // The header says "N matched nothing". If that N came from the truncated
    // list it would read 25 forever and understate the exact problem the
    // section exists to raise. docGapCounts must be the real totals.
    const conversations = []
    const messages: WindowMessage[] = []
    for (let i = 0; i < 40; i++) {
      conversations.push(conv(`c${i}`))
      messages.push(msg(`c${i}`, "user", `question number ${i}`, `2026-08-01T10:00:0${i % 10}Z`))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages.push(msg(`c${i}`, "assistant", "…", `2026-08-01T10:00:1${i % 10}Z`, { retrieval: { matched: 0 } } as any))
    }
    const out = computeInsights(win({ conversations, messages }), 30)

    expect(out.docGaps).toHaveLength(25)          // display is capped
    expect(out.docGapCounts.none).toBe(40)        // the count is not
    expect(out.docGapCounts.weak).toBe(0)
  })
})
