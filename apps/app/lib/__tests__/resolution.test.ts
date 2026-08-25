import { describe, it, expect } from "vitest"
import { resolve } from "@/lib/resolution/resolve"
import { REGISTRY, ALL_CODES, entry } from "@/lib/resolution/registry"
import type { ResolveInput } from "@/lib/resolution/types"

/** Fixed clock so every assertion is deterministic. */
const AT = "2026-08-25T09:00:00.000Z"
const base = (over: Partial<ResolveInput> = {}): ResolveInput => ({ observedAt: AT, ...over })

describe("registry integrity", () => {
  it("has unique, well-formed codes", () => {
    for (const code of ALL_CODES) {
      expect(code).toMatch(/^TXID-\d{4}$/)
      expect(REGISTRY[code]!.code).toBe(code)
    }
    expect(new Set(ALL_CODES).size).toBe(ALL_CODES.length)
  })

  it("gives every entry a machine cause and human wording", () => {
    for (const code of ALL_CODES) {
      const e = REGISTRY[code]!
      expect(e.cause).toMatch(/^[A-Z][A-Z_]+$/)
      expect(e.summary.length).toBeGreaterThan(10)
      expect(e.detail.length).toBeGreaterThan(10)
    }
  })

  // ASSERTION DISCIPLINE, enforced rather than documented. An external audit in
  // August 2026 found TxID's weakest claims were the ones that outran their
  // evidence, so the object must never assert safety on the user's behalf.
  it("never claims funds are safe", () => {
    for (const code of ALL_CODES) {
      const e = REGISTRY[code]!
      const text = `${e.summary} ${e.detail} ${e.next_step ?? ""}`.toLowerCase()
      expect(text).not.toMatch(/funds are safe|assets are safe|money is safe/)
    }
  })

  it("never attributes blame, only who can act next", () => {
    const owners = new Set(ALL_CODES.map(c => REGISTRY[c]!.next_action_owner))
    for (const o of owners) {
      expect(["user", "application", "protocol", "infrastructure", "none", "unknown"]).toContain(o)
    }
  })

  // Site style rule: no em dashes in anything user-facing.
  it("uses no em dashes in consumer-facing wording", () => {
    for (const code of ALL_CODES) {
      const e = REGISTRY[code]!
      expect(`${e.summary}${e.detail}${e.next_step ?? ""}`).not.toContain("—")
    }
  })

  it("returns undefined for an unknown code rather than throwing", () => {
    expect(entry("TXID-0000")).toBeUndefined()
  })
})

describe("classification: real failures TxID already diagnoses", () => {
  it("maps a Decibel spot balance abort to INSUFFICIENT_TOKEN_BALANCE", () => {
    // Observed on Aptos mainnet 2026-08-24.
    const r = resolve(base({
      chain: "aptos",
      hash: "0x666ac30f4c196c038dbb17cf9440490c71c757576b213d831ba1b99a4b906f8b",
      onchain: "failure",
      abort: {
        cause: "move_abort",
        module: "0x50ead22a::spot_order_public_api",
        code: 1,
        errorName: "EINSUFFICIENT_PFS_FUNDS",
        mapped: true,
      },
    }))
    expect(r.txid_code).toBe("TXID-2005")
    expect(r.category).toBe("BALANCE")
    expect(r.status).toBe("failed")
    expect(r.custody).toBe("unchanged")
    expect(r.gas_spent).toBe(true)
    expect(r.next_action_owner).toBe("user")
    expect(r.retryable).toBe("after_change")
    expect(r.basis).toBe("verified")
  })

  it("maps a Decibel cancel abort to ORDER_NOT_FOUND, needing no user action", () => {
    const r = resolve(base({
      chain: "aptos",
      onchain: "failure",
      abort: { cause: "move_abort", module: "0x50ead22a::single_order_book", code: 2, errorName: "EORDER_NOT_FOUND", mapped: true },
    }))
    expect(r.txid_code).toBe("TXID-5006")
    expect(r.next_action_owner).toBe("none")
    expect(r.retryable).toBe("no")
  })

  it("does not guess at an unmapped protocol abort", () => {
    const r = resolve(base({
      chain: "aptos",
      onchain: "failure",
      abort: { cause: "move_abort", module: "0xabc::vault", code: 77, mapped: false },
    }))
    expect(r.txid_code).toBe("TXID-9002")
    expect(r.category).toBe("INDETERMINATE")
    expect(r.basis).toBe("indeterminate")
    expect(r.retryable).toBe("unknown")
  })

  it("maps an EVM slippage revert", () => {
    const r = resolve(base({
      chain: "0x1",
      onchain: "failure",
      revert: { cause: "revert_reason", reason: "INSUFFICIENT_OUTPUT_AMOUNT" },
    }))
    expect(r.txid_code).toBe("TXID-5001")
    expect(r.recommended_action).toBe("ADJUST_SLIPPAGE")
  })

  it("maps an allowance revert to APPROVAL, not BALANCE", () => {
    const r = resolve(base({
      onchain: "failure",
      revert: { cause: "revert_reason", reason: "ERC20: transfer amount exceeds allowance" },
    }))
    expect(r.txid_code).toBe("TXID-4001")
    expect(r.category).toBe("APPROVAL")
    expect(r.recommended_action).toBe("APPROVE_TOKEN")
  })

  it("distinguishes a balance revert from an allowance revert", () => {
    const r = resolve(base({
      onchain: "failure",
      revert: { cause: "revert_reason", reason: "ERC20: transfer amount exceeds balance" },
    }))
    expect(r.txid_code).toBe("TXID-2005")
  })

  it("treats out of gas as a limit problem, and charges a fee", () => {
    const r = resolve(base({
      onchain: "failure",
      revert: { cause: "out_of_gas", gasInfo: { used: 21000, limit: 21000, percentUsed: 100 } },
    }))
    expect(r.txid_code).toBe("TXID-2003")
    expect(r.recommended_action).toBe("RETRY_WITH_HIGHER_GAS_LIMIT")
    expect(r.gas_spent).toBe(true)
  })

  it("maps a Solidity panic to a contract defect the user cannot fix", () => {
    const r = resolve(base({ onchain: "failure", revert: { cause: "panic", reason: "panic code 0x11" } }))
    expect(r.txid_code).toBe("TXID-6001")
    expect(r.category).toBe("CONTRACT_DEFECT")
    expect(r.next_action_owner).toBe("protocol")
    expect(r.retryable).toBe("no")
  })

  it("maps a rejected signature to a no-fee, retryable non-submission", () => {
    const r = resolve(base({ walletError: "MetaMask Tx Signature: User rejected the request." }))
    expect(r.txid_code).toBe("TXID-1001")
    expect(r.status).toBe("not_submitted")
    expect(r.gas_spent).toBe(false)
    expect(r.retryable).toBe("yes")
  })

  it("maps a stuck pending transaction to the blocking predecessor", () => {
    const r = resolve(base({ pending: { cause: "pending_stuck_nonce" } }))
    expect(r.txid_code).toBe("TXID-3006")
    expect(r.status).toBe("pending")
    expect(r.gas_spent).toBe(false)
  })

  it("reports a missing transaction without asserting it never existed", () => {
    const r = resolve(base({ chain: "aptos", hash: "0xdead", onchain: "not_found" }))
    expect(r.txid_code).toBe("TXID-9003")
    expect(r.detail).toMatch(/retention window/)
    expect(r.basis).toBe("indeterminate")
  })
})

describe("precedence and the fields no explorer can produce", () => {
  it("lets caller-declared off-chain state beat a missing transaction", () => {
    // The chain would say "no such transaction". The truth is "not created yet".
    const r = resolve(base({ onchain: "not_found", offchainState: "compliance_review" }))
    expect(r.txid_code).toBe("TXID-8001")
    expect(r.status).toBe("not_submitted")
    expect(r.next_action_owner).toBe("application")
    expect(r.basis).toBe("reported")
  })

  it("flags a technically successful transaction whose intent was not met", () => {
    const r = resolve(base({ onchain: "success", intent: "withdraw", intentMet: false }))
    expect(r.txid_code).toBe("TXID-7003")
    expect(r.status).toBe("succeeded_intent_unmet")
    expect(r.intent).toBe("withdraw")
    expect(r.intent_met).toBe(false)
  })

  it("resolves a plain success to no fault and no action", () => {
    const r = resolve(base({ onchain: "success" }))
    expect(r.txid_code).toBe("TXID-0001")
    expect(r.status).toBe("succeeded")
    expect(r.recommended_action).toBe("NO_ACTION")
  })

  it("prefers a decoded abort over a raw wallet string", () => {
    const r = resolve(base({
      onchain: "failure",
      abort: { cause: "move_abort", errorName: "EORDER_NOT_FOUND", mapped: true },
      walletError: "user rejected the request",
    }))
    expect(r.txid_code).toBe("TXID-5006")
  })
})

describe("object shape and provenance", () => {
  it("carries evidence, raw text and read time", () => {
    const r = resolve(base({
      chain: "aptos",
      hash: "0xabc",
      onchain: "failure",
      chainStateAt: "6908400201",
      abort: { cause: "move_abort", module: "0x50ead22a::spot_order_public_api", errorName: "EINSUFFICIENT_PFS_FUNDS", reason: "raw chain text", mapped: true },
    }))
    expect(r.observed_at).toBe(AT)
    expect(r.chain_state_at).toBe("6908400201")
    expect(r.raw).toBe("raw chain text")
    expect(r.evidence).toContainEqual({ kind: "transaction", hash: "0xabc", origin: "looked_up", chain: "aptos" })
    expect(r.evidence.some(e => e.kind === "contract")).toBe(true)
  })

  it("does not duplicate a transaction the caller already supplied as evidence", () => {
    const r = resolve(base({
      hash: "0xabc",
      onchain: "failure",
      revert: { cause: "unknown_revert" },
      evidence: [{ kind: "transaction", hash: "0xabc", origin: "user_supplied" }],
    }))
    const txs = r.evidence.filter(e => e.kind === "transaction")
    expect(txs).toHaveLength(1)
    // A hash the user pasted is a claim about their history, not a finding of ours.
    expect(txs[0]).toMatchObject({ origin: "user_supplied" })
  })

  it("emits no confidence score, by design", () => {
    const r = resolve(base({ onchain: "failure", revert: { cause: "unknown_revert" } }))
    expect(r).not.toHaveProperty("confidence")
    expect(["verified", "derived", "reported", "indeterminate"]).toContain(r.basis)
  })

  it("never throws on empty input, and says so honestly", () => {
    const r = resolve(base())
    expect(r.txid_code).toBe("TXID-9004")
    expect(r.basis).toBe("indeterminate")
    expect(r.category).toBe("INDETERMINATE")
  })
})
