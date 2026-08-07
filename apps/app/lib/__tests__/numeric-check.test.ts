import { describe, expect, it } from "vitest"
import { unverifiedNumbers } from "../numeric-check"

/**
 * The guardrail's contract, pinned after it misfired on correct answers twice
 * in one afternoon (a RECOMMENDED gas limit, then a swap's derived output
 * amount). Every case here was reproduced against the real strings involved
 * before becoming a test.
 */
describe("unverifiedNumbers", () => {
  const seen = new Set(["174103", "172362", "43114"])

  it("does not flag a correct out-of-gas diagnosis with a recommended new limit", () => {
    const answer =
      "The transaction failed due to running out of gas. You called exactInputSingle on 10 July 2026, " +
      "but the gas limit (174,103 units) was too low, the transaction consumed 99% of it and ran out before completing.\n\n" +
      "To retry: increase the gas limit in your wallet settings (advanced options) to at least 200,000 units and submit again."
    expect(unverifiedNumbers(answer, seen, "")).toEqual([])
  })

  it("still catches an invented figure about the user's own position", () => {
    expect(unverifiedNumbers("Your collateral is $4,812.33 right now.", seen, "")).toEqual(["4,812.33"])
  })

  it("accepts a correctly formatted quote of a raw tool value", () => {
    expect(unverifiedNumbers("BTC mark is $63,695.70.", new Set(["63695700000"]), "")).toEqual([])
  })

  it("exempting a recommended value does not exempt the same digits asserted as fact", () => {
    expect(
      unverifiedNumbers("Set it to at least 200,000. Your balance is 918,442 units.", seen, ""),
    ).toEqual(["918,442"])
  })

  it("a hedged report ('about') is still a reported value and must trace", () => {
    expect(unverifiedNumbers("Your balance is about 4,812 USDC.", seen, "")).toEqual(["4,812"])
  })

  it("a suggestion cue cannot leak across a sentence boundary", () => {
    expect(
      unverifiedNumbers("Increase the gas limit. Your balance is 4,812 USDC.", seen, ""),
    ).toEqual(["4,812"])
  })
})
