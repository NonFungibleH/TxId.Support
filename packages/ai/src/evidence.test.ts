import { describe, it, expect } from "vitest"
import { mergeToolEvidence, toolEvidenceFrom } from "./evidence"

/**
 * The case record's "what did not run" column, tested in BOTH directions.
 *
 * This is the machinery behind rule 3, and it has been wrong twice, each time
 * in a way that read fine from the outside:
 *
 *  1. Sixteen Aptos tool results reported a failure under `error`, or under a
 *     scoped key like `holdingsNote`, and set no marker. The MODEL was told
 *     correctly, so every answer was honest and nobody noticed. What was wrong
 *     was the RECORD: `failedLookups` missed them, so did the `read_failed`
 *     ticket signal, and so did the export an auditor reads.
 *  2. When the marker WAS set beside a key that was not literally `note`, the
 *     recorded text became the literal string "lookup failed", so the record
 *     said a lookup failed without saying which.
 *
 * A test per tool would not have caught either. Both are properties of the
 * merge, which is what this exercises.
 */
const ev = (tool: string, result: unknown) => toolEvidenceFrom(tool, result, false)
const failedFrom = (tool: string, result: unknown) =>
  mergeToolEvidence([ev(tool, result)]).failedLookups

describe("a read that did not complete is recorded, whatever key carried the reason", () => {
  it("records it from note", () => {
    expect(failedFrom("get_wallet_balance", {
      lookupFailed: true, note: "Could not reach the Aptos indexer.",
    })).toEqual(["Could not reach the Aptos indexer."])
  })

  // The Aptos tools report failures under `error`, not `note`. That is the
  // shape that went unrecorded for five days.
  it("records it from error", () => {
    expect(failedFrom("get_token_info", {
      lookupFailed: true, error: "Could not reach the Aptos indexer to look up this asset.",
    })).toEqual(["Could not reach the Aptos indexer to look up this asset."])
  })

  // A scoped note means only PART of a result is missing, which is the quiet
  // version of the same bug: the answer looks complete.
  it("records it from a scoped somethingNote", () => {
    expect(failedFrom("get_contract_holdings", {
      contract: "x", holdings: [], lookupFailed: true,
      holdingsNote: "The holdings list could not be read.",
    })).toEqual(["The holdings list could not be read."])
  })

  it("never records the bare words 'lookup failed' when a reason was given", () => {
    const [only] = failedFrom("t", { lookupFailed: true, error: "The Sui RPC did not respond." })
    expect(only).toBe("The Sui RPC did not respond.")
    expect(only).not.toBe("lookup failed")
  })

  it("still records a marked read that carried no words at all", () => {
    // Better to record that SOMETHING did not run than to drop it silently.
    expect(failedFrom("t", { lookupFailed: true })).toHaveLength(1)
  })
})

describe("a genuine finding is not filed as a failed lookup", () => {
  /**
   * THE MIRROR ERROR, AND THE MORE DANGEROUS ONE. An answer wrongly filed
   * under "what did not run" buries a real finding and teaches whoever reads
   * that column to ignore it.
   *
   * These note strings are taken verbatim from the tool arms, and several of
   * them contain the phrase "failed lookup" while explicitly NEGATING it. The
   * legacy fallback matches on phrasing, so this is exactly where a
   * negation-blind regex would misfire.
   */
  const FINDINGS: Array<[string, Record<string, unknown>]> = [
    ["hyperliquid never traded", { address: "0x1", neverTraded: true,
      note: "The exchange answered and this address has no positions, no spot balance and no account value. That is a real answer, not a failed lookup: it has never traded here." }],
    ["hyperliquid no orders", { address: "0x1", orders: [],
      note: "The exchange has no order history for this address. That is an answer, not a failed lookup." }],
    ["stellar no account", { address: "G1", transactions: [],
      note: "Horizon has no such account, so there is no history. That is an answer, not a failed lookup." }],
    ["sui no history", { address: "0x1", transactions: [],
      note: "The node has no transactions for this Sui address. That is an answer, not a failed lookup." }],
    ["near tx not found", { hash: "h", chainId: "near", status: "not_found",
      note: "An archival NEAR node looked and has no transaction with this hash. That is an answer, not a failed lookup: either the hash is wrong or the transaction was never submitted." }],
    ["aptos object is a wallet", { address: "0x1", isObject: false,
      note: "The indexer has no object at this address, so it is most likely an ordinary account (a wallet) rather than an object." }],
  ]

  for (const [name, result] of FINDINGS) {
    it(`does not record: ${name}`, () => {
      expect(failedFrom("t", result)).toEqual([])
    })
  }

  it("a successful read counts as a read that succeeded", () => {
    const merged = mergeToolEvidence([ev("get_wallet_balance", { balance: "1.5", symbol: "ETH" })])
    expect(merged.anyReadSucceeded).toBe(true)
    expect(merged.failedLookups).toEqual([])
  })
})

describe("grounding cannot be claimed off a failed read", () => {
  /**
   * `anyReadSucceeded` drives whether an answer is graded `verified` rather
   * than `ungrounded`. A tool call that threw, or that reported a failure,
   * must not be able to lift an answer into the higher grade.
   */
  it("a thrown tool call does not count as a successful read", () => {
    const merged = mergeToolEvidence([toolEvidenceFrom("get_wallet_balance", { error: "boom" }, true)])
    expect(merged.anyReadSucceeded).toBe(false)
  })

  it("mixing a failure with a success records both, and keeps them apart", () => {
    const merged = mergeToolEvidence([
      ev("get_wallet_balance", { balance: "2", symbol: "SOL" }),
      ev("get_wallet_approvals", { lookupFailed: true, note: "Could not reach the approvals indexer." }),
    ])
    expect(merged.anyReadSucceeded).toBe(true)
    expect(merged.failedLookups).toEqual(["Could not reach the approvals indexer."])
    expect(merged.toolsUsed).toContain("get_wallet_approvals")
  })
})

describe("the arms that actually ship set the marker", () => {
  /**
   * The exact object `get_token_info` returns when the Aptos indexer is
   * unreachable. Its prose is correct and tells the model precisely the right
   * thing. It carried no marker, and because the legacy fallback only ever
   * inspects a key literally called `note`, a failure reported under `error`
   * was invisible to the record: the user got an honest answer and the export
   * an auditor reads said nothing had gone wrong.
   */
  it("get_token_info's Aptos failure reaches the record", () => {
    const shipped = {
      token: "0x1::aptos_coin::AptosCoin",
      lookupFailed: true,
      error: "Could not reach the Aptos indexer to look up this asset right now, a failed lookup, not a statement about the asset. Try again shortly.",
    }
    expect(failedFrom("get_token_info", shipped)).toHaveLength(1)
  })
})

describe("no tool arm hides a failure from the record", () => {
  /**
   * A SOURCE check, deliberately, because the bug it guards is a property of
   * the whole file rather than of any one arm: each offending result is
   * perfectly defensible read on its own.
   *
   * The rule it enforces is narrow on purpose. The legacy phrase fallback in
   * evidence.ts only ever inspects a key literally called `note`, so a failure
   * reported under `error` or a scoped `somethingNote` is invisible unless the
   * marker is set. That is exactly how sixteen Aptos reads went unrecorded,
   * and how get_token_info was still doing it today.
   *
   * It checks ONLY that combination. Broader phrase-matching was tried first
   * and produced thirteen hits, eleven of them correct code saying "that is an
   * answer, NOT a failed lookup": a guard that cannot tell an assertion from
   * its negation gets switched off, which is worse than not having one.
   */
  it("every failure carried under error or a scoped note sets the marker", async () => {
    const { readFileSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    const src = readFileSync(resolve(__dirname, "tools.ts"), "utf8")

    const arms = [...src.matchAll(/\n    case "([a-z_]+)":/g)].map(m => ({ name: m[1]!, at: m.index! }))
    expect(arms.length, "found no tool arms, so this test cannot fail").toBeGreaterThan(15)

    const offenders: string[] = []
    for (let i = 0; i < arms.length; i++) {
      const body = src.slice(arms[i]!.at, arms[i + 1]?.at ?? src.length)
      for (let k = body.indexOf("return {"); k !== -1; k = body.indexOf("return {", k + 1)) {
        let depth = 0, end = k
        for (let j = body.indexOf("{", k); j < body.length; j++) {
          if (body[j] === "{") depth++
          else if (body[j] === "}") { depth--; if (depth === 0) { end = j; break } }
        }
        const block = body.slice(k, end + 1)
        const hidden = /\berror:\s*[`"]|\b\w+Note:\s*[`"]/.test(block)
        const failure = /[Cc]ould not|did not respond|failed lookup|unreachable/.test(block)
        if (hidden && failure && !block.includes("lookupFailed")) {
          offenders.push(`${arms[i]!.name}: ${block.replace(/\s+/g, " ").slice(0, 100)}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
