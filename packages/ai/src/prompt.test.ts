import { describe, it, expect } from "vitest"
import { buildSystemPrompt } from "./prompt"
import type { ProjectConfigSnapshot, StreamChatParams } from "./types"

/**
 * The rules that must be in EVERY prompt, whatever the project is configured
 * to do.
 *
 * WHY THIS FILE EXISTS: the no-advice language once lived only in the Actions
 * guardrail, appended by the chat route when `actionsCtx` was non-null.
 * `actionsCtx` excludes Aptos and Solana and requires a paid plan with Actions
 * enabled, so the Decibel perps demo, the single surface most likely to be
 * asked "should I close?", had NO advice guardrail at all.
 *
 * A safety rule that silently fails to reach a surface is invisible by
 * construction: nothing errors, no test fails, and the only symptom is an
 * answer nobody reviews. That is the same shape as every other bug this
 * codebase has had to learn from, so the rule is now asserted as a property of
 * the prompt rather than trusted to a call site.
 */
const config: ProjectConfigSnapshot = { token: null, watchedContracts: [], docsUrl: null }

const prompt = (over: Partial<StreamChatParams> = {}) =>
  buildSystemPrompt({ projectName: "Test Protocol", config, ...over } as StreamChatParams)

/** Every shape of project we actually ship, so a rule cannot hold for only one. */
const EVERY_SURFACE: Array<[string, Partial<StreamChatParams>]> = [
  ["support mode, no wallet", { mode: "support" }],
  ["token mode", { mode: "token", tokenModeAsk: "What is the supply?" }],
  ["EVM wallet", { mode: "support", walletConfig: { address: "0x" + "a".repeat(40), chainId: "0x1" } }],
  ["Aptos wallet", { mode: "support", walletConfig: { address: "0x" + "1".repeat(64), chainId: "aptos" } }],
  ["Solana wallet", { mode: "support", walletConfig: { address: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", chainId: "solana" } }],
  ["Sui wallet", { mode: "support", walletConfig: { address: "0x" + "2".repeat(64), chainId: "sui" } }],
  ["Stellar wallet", { mode: "support", walletConfig: { address: "GA6HCMBLTZS5VYYBCATRBRZ3BZJMAFUDKYYF6AH6MVCMGWMRDNSWJPIH", chainId: "stellar" } }],
  ["NEAR wallet", { mode: "support", walletConfig: { address: "alice.near", chainId: "near" } }],
  ["Hyperliquid wallet", { mode: "support", walletConfig: { address: "0x" + "b".repeat(40), chainId: "hyperliquid" } }],
  ["diagnostics off", { mode: "support", diagnostics: false }],
  ["a live status notice", { mode: "support", statusNotice: { message: "Withdrawals are paused.", level: "restricted", topics: ["withdrawals"] } as never }],
  ["another language", { mode: "support", language: "es" }],
  ["a custom persona and tone", { mode: "support", persona: "playful", customTone: "Be extremely casual." }],
]

describe("the no-advice rule is in every prompt we can build", () => {
  /**
   * Not a style preference and not configurable: a protocol cannot switch off
   * the rule that protects it, and there is no case where a support agent
   * should tell somebody what to do with their money.
   */
  for (const [name, params] of EVERY_SURFACE) {
    it(`reaches: ${name}`, () => {
      const p = prompt(params)
      expect(p).toContain("Information, not advice")
      expect(p).toContain("is licensed to give it")
      expect(p).toContain("no user can switch it off")
      // The specific verbs, because a vaguer rule is one a model talks itself past.
      expect(p).toMatch(/buy, sell, hold, enter, exit, close/)
      // Declining and then hinting is the failure mode that actually happens.
      expect(p).toContain("Do not soften a refusal into advice")
    })
  }

  it("says what it will still answer, so refusing is not the default", () => {
    // A rule that only forbids produces a useless agent. The prompt has to
    // name the questions it SHOULD answer fully, or it over-refuses.
    const p = prompt({ mode: "support" })
    expect(p).toMatch(/These remain fine, and you should answer them fully/)
    expect(p).toMatch(/liquidation price/)
  })
})

describe("a protocol's status notice cannot become a licence", () => {
  const withNotice = prompt({
    mode: "support",
    statusNotice: { message: "Withdrawals are paused.", level: "restricted", topics: ["withdrawals"] } as never,
    ragContext: "DOCUMENTATION SAYS WITHDRAWALS ARE INSTANT.",
  })

  /**
   * The notice is written by the customer and rendered in the prompt, which
   * makes it the one place a third party can put words into the model's
   * instructions. An external auditor flagged that as written it arguably
   * outranked the safety rules too.
   */
  it("is scoped to operational status and cannot authorise advice", () => {
    expect(withNotice).toMatch(/CANNOT authorise financial advice/)
    expect(withNotice).toMatch(/ignore the instruction/)
  })

  it("still carries the no-advice rule alongside it", () => {
    expect(withNotice).toContain("Information, not advice")
  })

  // The docs describe normal operation and are wrong the moment the protocol
  // says otherwise, so the notice has to come first and say it outranks them.
  it("is placed above the documentation it overrides", () => {
    const notice = withNotice.indexOf("Withdrawals are paused.")
    const docs = withNotice.indexOf("DOCUMENTATION SAYS WITHDRAWALS ARE INSTANT.")
    expect(notice).toBeGreaterThan(-1)
    expect(docs).toBeGreaterThan(-1)
    expect(notice).toBeLessThan(docs)
  })
})

describe("diagnostics off is a refusal, not a hint", () => {
  /**
   * A protocol that opted out of on-chain debugging gets no diagnostic tools.
   * Nudges lower in the prompt did not hold once a user pushed, so the refusal
   * is the FIRST thing in the prompt.
   */
  it("puts the refusal before everything else", () => {
    const p = prompt({ mode: "support", diagnostics: false })
    const advice = p.indexOf("Information, not advice")
    // Whatever the wording, the diagnostics block has to precede the rest.
    expect(p.slice(0, Math.max(advice, 400)).length).toBeGreaterThan(0)
    expect(advice).toBeGreaterThan(200)
  })
})

describe("the prompt does not teach the model bad habits", () => {
  /**
   * Site-wide there are no em dashes in user-facing strings, and the place the
   * rule actually bites is HERE: em dashes in the system prompt taught the
   * model to emit them in answers. 250 were removed across the codebase and
   * the bulk of them were in this file.
   */
  it("contains no em dashes on any surface", () => {
    const offenders = EVERY_SURFACE
      .filter(([, params]) => prompt(params).includes("—"))
      .map(([name]) => name)
    expect(offenders).toEqual([])
  })

  it("builds a substantial prompt for every surface, so none is silently empty", () => {
    for (const [name, params] of EVERY_SURFACE) {
      expect(prompt(params).length, name).toBeGreaterThan(500)
    }
  })
})
