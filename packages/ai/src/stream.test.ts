import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

/**
 * The narration hold, which is the one piece of streaming logic that can lose
 * a user's answer.
 *
 * Text arriving just before a tool call is the model thinking aloud ("Let me
 * check that for you"). The widget already renders a live label per tool call,
 * so that narration is a second, worse status line. It is therefore HELD until
 * either a tool call proves what it was (drop it) or the round ends without one
 * (it was the answer, emit it).
 *
 * The two directions fail very differently. Emitting narration is noise.
 * DROPPING AN ANSWER IS AN EMPTY BUBBLE, and there is already one recorded
 * instance of exactly that: text before `create_support_ticket` is the line
 * acknowledging what the user said, the widget STOPS the stream on the escalate
 * event, so dropping it lost it rather than deferring it. A tester who left
 * feedback got an empty bubble and then a form, which reads as the assistant
 * having given up.
 */

// ── A controllable stand-in for the Anthropic streaming client ───────────────
type Ev = Record<string, unknown>
const textDelta = (text: string): Ev => ({ type: "content_block_delta", delta: { type: "text_delta", text } })
const toolStart = (name: string, id = name): Ev => ({
  type: "content_block_start",
  content_block: { type: "tool_use", id, name, input: {} },
})

let ROUNDS: Ev[][] = []
let roundIndex = 0

function fakeStream(events: Ev[], stopReason: "end_turn" | "tool_use") {
  return {
    async *[Symbol.asyncIterator]() { for (const e of events) yield e },
    async finalMessage() {
      return {
        stop_reason: stopReason,
        content: events
          .filter(e => e.type === "content_block_start")
          .map(e => (e as { content_block: unknown }).content_block),
        usage: { input_tokens: 1, output_tokens: 1 },
      }
    },
  }
}

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = {
      stream: () => {
        const events = ROUNDS[roundIndex] ?? []
        const hasTool = events.some(e => e.type === "content_block_start")
        roundIndex++
        return fakeStream(events, hasTool ? "tool_use" : "end_turn")
      },
    }
  },
}))

// Tool execution is not under test; keep every call cheap and successful.
vi.mock("./tools", async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  executeTool: vi.fn(async () => ({ ok: true })),
}))

async function run(rounds: Ev[][]): Promise<{ text: string; events: string[] }> {
  ROUNDS = rounds
  roundIndex = 0
  const { streamChatWithTools } = await import("./stream")
  const out: string[] = []
  const events: string[] = []
  for await (const e of streamChatWithTools("system", [{ role: "user", content: "hi" }] as never, null, [])) {
    events.push(e.type)
    if (e.type === "text") out.push(e.text)
  }
  return { text: out.join(""), events }
}

beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key")
  vi.resetModules()
})
afterEach(() => vi.unstubAllEnvs())

describe("text held before a tool call", () => {
  /**
   * The whole point: short narration followed by a tool call never reaches the
   * user, because the widget is already showing a label for that call.
   */
  it("is dropped when a tool call proves it was narration", async () => {
    const { text } = await run([
      [textDelta("Let me check that."), toolStart("get_wallet_balance")],
      [textDelta("Your balance is 2 ETH.")],
    ])
    expect(text).not.toContain("Let me check that.")
    expect(text).toContain("Your balance is 2 ETH.")
  })

  /**
   * THE DANGEROUS DIRECTION. A short answer with no tool call after it must
   * still reach the user. Getting this wrong is an empty bubble, and the user
   * sees the assistant say nothing at all.
   */
  it("is emitted when the round ends without one, however short", async () => {
    const { text } = await run([[textDelta("No.")]])
    expect(text).toBe("No.")
  })

  it("streams a long answer rather than holding it to the end", async () => {
    // Past the 80-character cap the text is real content, not narration, so it
    // flushes live instead of waiting for the round to prove it.
    const long = "This transaction failed because the contract reverted while checking your allowance, which is a different problem from running out of gas."
    const { text } = await run([[textDelta(long)]])
    expect(text).toBe(long)
  })
})

describe("escalation text is the answer, not narration", () => {
  /**
   * `create_support_ticket` is the documented exception. The widget stops the
   * stream on the escalate event, so held text is LOST rather than deferred.
   * This is a real regression that reached a tester.
   */
  it("emits the line before create_support_ticket", async () => {
    const { text } = await run([
      [textDelta("Sorry that happened, I'll pass this to the team."), toolStart("create_support_ticket")],
      [textDelta("")],
    ])
    expect(text).toContain("Sorry that happened")
  })

  it("still drops narration before an ordinary tool call", async () => {
    const { text } = await run([
      [textDelta("One moment."), toolStart("get_recent_transactions")],
      [textDelta("You have 3 transactions.")],
    ])
    expect(text).not.toContain("One moment.")
  })
})

describe("the user is never left with nothing", () => {
  /**
   * `anyTextThisTurn` means text actually REACHED THE USER, which is what the
   * never-blank fallback should have been keying on all along. A turn that
   * produced only tool calls must still end with something said.
   */
  it("says something even when every round was tool calls", async () => {
    const { text } = await run([
      [toolStart("get_wallet_balance")],
      [toolStart("get_recent_transactions", "t2")],
      [],
    ])
    expect(text.trim().length).toBeGreaterThan(0)
  })
})

describe("rounds do not run together", () => {
  it("puts a paragraph break between text from separate rounds", async () => {
    const { text } = await run([
      [textDelta("First finding here."), toolStart("get_wallet_balance")],
      [textDelta("Second part of the answer.")],
      [textDelta("Third part of the answer.")],
    ])
    // Whatever else happens, two emitted rounds must not be glued together.
    if (text.includes("Second part") && text.includes("Third part")) {
      expect(text).toMatch(/Second part of the answer\.\s*\n\n/)
    }
  })
})
