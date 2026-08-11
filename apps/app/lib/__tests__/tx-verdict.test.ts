import { describe, expect, it } from "vitest"
import { verdictFor } from "../tx-verdict"
import type { TxDiagnosis } from "@txid/blockchain"

const base: TxDiagnosis = {
  status: "failed", chain: "Ethereum", chainId: "0x1", cause: "custom_error",
  error: null, explanation: "", fix: null, tokenTransfers: [], gas: { verdict: null }, method: null,
}

describe("verdictFor", () => {
  it("the on-chain-success-but-no-money case points downstream, not at the chain", () => {
    // This is the whole reason the tool beats a block explorer for a payments
    // user: the classic "explorer says success, customer says no money" ticket.
    const v = verdictFor({ ...base, status: "success", cause: "success" })
    expect(v.tone).toBe("success")
    expect(v.customerMessage).toMatch(/completed as expected/i)
    expect(v.customerMessage).toMatch(/hold-up is with the service crediting the destination/i)
  })

  it("slippage failure is explained in plain English with a real next step", () => {
    const v = verdictFor({ ...base, cause: "custom_error", error: "SlippageTooHigh" })
    expect(v.tone).toBe("failed")
    expect(v.headline).toMatch(/price moved too much/i)
    expect(v.customerMessage).toMatch(/slippage tolerance/i)
    // Never claim funds were lost on a revert.
    expect(v.customerMessage).toMatch(/No money left your wallet/i)
  })

  it("out of gas is its own message, not a generic revert", () => {
    const v = verdictFor({ ...base, cause: "out_of_gas", error: null })
    expect(v.headline).toMatch(/ran out of gas/i)
    expect(v.customerMessage).toMatch(/raise the gas limit/i)
  })

  it("allowance failure tells the user to approve the token", () => {
    const v = verdictFor({ ...base, cause: "custom_error", error: "ERC20: insufficient allowance" })
    expect(v.headline).toMatch(/wasn't approved/i)
    expect(v.customerMessage).toMatch(/approve the token/i)
  })

  it("an unmapped custom error still names it and never invents a cause", () => {
    const v = verdictFor({ ...base, cause: "custom_error", error: "ZoraMintLimit" })
    expect(v.headline).toContain("ZoraMintLimit")
    expect(v.customerMessage).toContain("ZoraMintLimit")
  })

  it("uses the method name in the sentence when we decoded one", () => {
    const v = verdictFor({ ...base, cause: "out_of_gas", method: "swapExactTokensForTokens" })
    expect(v.customerMessage).toMatch(/Your swapExactTokensForTokens transaction/)
  })

  it("pending waits, and the gas-balance stuck case is distinct", () => {
    expect(verdictFor({ ...base, status: "pending", cause: "pending_underpriced" }).customerMessage)
      .toMatch(/still pending/i)
    expect(verdictFor({ ...base, status: "pending", cause: "insufficient_gas_balance" }).headline)
      .toMatch(/stuck/i)
  })

  it("not found is honest and blames the reference, not the user", () => {
    const v = verdictFor({ ...base, status: "not_found", cause: null, chain: null, chainId: null })
    expect(v.tone).toBe("not_found")
    expect(v.customerMessage).toMatch(/couldn't find|double-check/i)
  })

  it("every path returns a non-empty headline and a send-ready message", () => {
    for (const status of ["success", "failed", "pending", "not_found"] as const) {
      const v = verdictFor({ ...base, status })
      expect(v.headline.length).toBeGreaterThan(10)
      expect(v.customerMessage.length).toBeGreaterThan(30)
    }
  })
})
