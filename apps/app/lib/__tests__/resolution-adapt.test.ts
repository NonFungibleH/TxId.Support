import { describe, it, expect } from "vitest"
import { fromEvmDiagnosis, fromAptosTx, notFound } from "@/lib/resolution/adapt"
import { resolve } from "@/lib/resolution/resolve"

const AT = "2026-08-25T09:00:00.000Z"
const H = "0x" + "a".repeat(64)

describe("EVM diagnosis adapter", () => {
  it("splits a revert cause onto the revert branch", () => {
    const input = fromEvmDiagnosis(
      { status: "failed", chainId: "0x1", cause: "custom_error", error: "SlippageTooHigh", explanation: "the price moved" },
      H, { observedAt: AT },
    )
    expect(input.revert).toEqual({ cause: "custom_error", reason: "the price moved", errorName: "SlippageTooHigh" })
    expect(input.pending).toBeUndefined()
    expect(input.onchain).toBe("failure")
    expect(input.chain).toBe("0x1")
  })

  // TxDiagnosis packs BOTH revert and pending causes onto one `cause` string.
  // Getting this split wrong would file a mempool problem as a contract failure.
  it("splits a pending cause onto the pending branch", () => {
    const input = fromEvmDiagnosis(
      { status: "pending", chainId: "0x1", cause: "pending_underpriced", explanation: "fee below going rate" },
      H, { observedAt: AT },
    )
    expect(input.pending).toEqual({ cause: "pending_underpriced", reason: "fee below going rate" })
    expect(input.revert).toBeUndefined()
    expect(resolve(input).txid_code).toBe("TXID-3003")
  })

  it("falls back to unknown_revert for an unrecognised failure cause", () => {
    const input = fromEvmDiagnosis({ status: "failed", cause: "something_new" }, H, { observedAt: AT })
    expect(input.revert?.cause).toBe("unknown_revert")
    expect(resolve(input).txid_code).toBe("TXID-9001")
  })

  it("carries a success through with no failure branch", () => {
    const input = fromEvmDiagnosis({ status: "success", chainId: "0x2105" }, H, { observedAt: AT })
    expect(input.revert).toBeUndefined()
    expect(input.pending).toBeUndefined()
    expect(resolve(input).txid_code).toBe("TXID-0001")
  })

  it("passes caller context through to the resolver", () => {
    const r = resolve(fromEvmDiagnosis(
      { status: "success", chainId: "0x1" },
      H, { intent: "withdraw", intentMet: false, observedAt: AT },
    ))
    expect(r.status).toBe("succeeded_intent_unmet")
    expect(r.intent).toBe("withdraw")
  })
})

describe("Aptos adapter", () => {
  it("marks a protocol-mapped abort as mapped, giving a confident code", () => {
    const input = fromAptosTx({
      success: false,
      version: "6908400201",
      decodedAbort: {
        cause: "move_abort",
        module: "0x50ead22a::spot_order_public_api",
        code: 1,
        errorName: "EINSUFFICIENT_PFS_FUNDS",
        reason: "This spot order was rejected because the wallet's available balance is short on one side of the pair.",
      },
    }, H, { observedAt: AT })
    expect(input.abort?.mapped).toBe(true)
    const r = resolve(input)
    expect(r.txid_code).toBe("TXID-2005")
    expect(r.chain_state_at).toBe("6908400201")
  })

  // The decoder signals "no published meaning" through its wording. Treating
  // that as a real explanation would present a guess as a finding.
  it("marks an unmapped abort as unmapped, refusing to guess", () => {
    const input = fromAptosTx({
      success: false,
      decodedAbort: {
        cause: "move_abort",
        module: "0xabc::vault",
        code: 77,
        errorName: null,
        reason: "The transaction was rejected by 0xabc::vault with error code 77. The module doesn't publish a description for this code.",
      },
    }, H, { observedAt: AT })
    expect(input.abort?.mapped).toBe(false)
    expect(resolve(input).txid_code).toBe("TXID-9002")
  })

  it("handles the null-valued fields the real decoder emits", () => {
    const input = fromAptosTx({
      success: false,
      decodedAbort: { cause: "out_of_gas", module: null, code: null, errorName: null, reason: "ran out of gas" },
    }, H, { observedAt: AT })
    expect(input.abort?.code).toBeUndefined()
    expect(input.abort?.module).toBeUndefined()
    expect(resolve(input).txid_code).toBe("TXID-2003")
  })

  it("treats a successful Aptos transaction as a success", () => {
    expect(resolve(fromAptosTx({ success: true, version: "1" }, H, { observedAt: AT })).txid_code).toBe("TXID-0001")
  })
})

describe("not found", () => {
  it("resolves honestly rather than inventing a cause", () => {
    const r = resolve(notFound(H, { observedAt: AT }))
    expect(r.txid_code).toBe("TXID-9003")
    expect(r.basis).toBe("indeterminate")
  })

  it("still lets declared off-chain state answer the question", () => {
    const r = resolve(notFound(H, { observedAt: AT, offchainState: "compliance_review" }))
    expect(r.txid_code).toBe("TXID-8001")
    expect(r.basis).toBe("reported")
  })
})
