import { describe, it, expect } from "vitest"
import { decodeAbort } from "./abort"

describe("decodeAbort", () => {
  // REAL mainnet status, version 7065372986, captured by scripts/failure-census.ts.
  // Decibel embeds its own multi-line doc comment in the abort message, which
  // used to kill the regex and produce cause "unknown" for a failure we hold a
  // written answer for. 9 of 231 sampled Decibel failures looked like this.
  it("decodes a multi-line vm_status (Decibel embeds doc comments in aborts)", async () => {
    const { PROTOCOL_ERRMAPS } = await import("./errmap")
    const vmStatus =
      "Move abort in 0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06::spot_order_public_api: " +
      "EINSUFFICIENT_PFS_FUNDS(0x1): PFS-sourced bulk order rejected because the user's PFS balance is\n" +
      " short on either the base or quote side. Asserted up front in\n" +
      " `place_bulk_order_from_pfs` so the failure surfaces cleanly here\n" +
      " instead of as the generic abort that\n" +
      " `primary_fungible_store::withdraw` would raise mid-placement."
    const d = decodeAbort(vmStatus, PROTOCOL_ERRMAPS)
    expect(d.cause).toBe("move_abort")
    expect(d.errorName).toBe("EINSUFFICIENT_PFS_FUNDS")
    expect(d.code).toBe(1)
    // the protocol map's own wording, not the developer prose from the chain
    expect(d.reason).toMatch(/available balance is short on one side of the pair/i)
    expect(d.reason).not.toMatch(/doesn't recognize/i)
  })

  it("parses canonical std::error abort with category", () => {
    const d = decodeAbort("Move abort in 0x1::coin: 0x10006")
    expect(d.cause).toBe("move_abort")
    expect(d.module).toBe("0x1::coin")
    expect(d.code).toBe(0x10006)
    expect(d.category).toBe("invalid argument")   // category bits of 0x10006 are 1 (extract via BigInt, not >>)
    expect(d.errorName).toBe("EINSUFFICIENT_BALANCE") // framework table hit
    expect(d.reason).toMatch(/insufficient balance/i)
  })
  it("handles raw small-constant abort honestly (no category)", () => {
    const d = decodeAbort("Move abort in 0xabc::stable_pool: 0x7")
    expect(d.category).toBeNull()
    expect(d.errorName).toBeNull()
    expect(d.reason).toMatch(/code 7/)
    expect(d.reason).not.toMatch(/guarantee|certainly/i)
  })
  it("parses named-error variant 'EINSUFFICIENT_BALANCE(0x10006)'", () => {
    const d = decodeAbort("Move abort in 0x1::coin: EINSUFFICIENT_BALANCE(0x10006)")
    expect(d.errorName).toBe("EINSUFFICIENT_BALANCE")
    expect(d.code).toBe(0x10006)
  })
  it("handles OUT_OF_GAS", () => {
    expect(decodeAbort("Out of gas").cause).toBe("out_of_gas")
  })
  it("handles EXECUTION_FAILURE and unknown strings", () => {
    expect(decodeAbort("Execution failed in 0x1::x at code offset 5").cause).toBe("execution_failure")
    expect(decodeAbort("something novel").cause).toBe("unknown")
  })
  it("errmap overrides generic reason", () => {
    const d = decodeAbort("Move abort in 0xdead::pool: 0x3", { "0xdead::pool": { 3: { name: "E_SLIPPAGE", reason: "Output below the minimum you set (slippage)." } } })
    expect(d.errorName).toBe("E_SLIPPAGE")
    expect(d.reason).toMatch(/slippage/)
  })
  it("falls back to errmap name matching when the code is category-wrapped", () => {
    const errmap = { "0xdead::perp_engine": { 4: { name: "EMARKET_HALTED", reason: "The market is halted right now." } } }
    const d = decodeAbort("Move abort in 0xdead::perp_engine: EMARKET_HALTED(0x30004): ", errmap)
    expect(d.errorName).toBe("EMARKET_HALTED")
    expect(d.code).toBe(0x30004)
    expect(d.category).toBe("invalid state")
    expect(d.reason).toBe("The market is halted right now.")
  })
  it("never invents a category for large raw u64 codes", () => {
    const d = decodeAbort("Move abort in 0xabc::vault: 18446744073709551615")
    expect(d.category).toBeNull()
    expect(d.code).toBeNull() // exceeds MAX_SAFE_INTEGER — kept only in raw/reason
    expect(d.reason).toMatch(/18446744073709551615/)
  })
  it("never throws on non-string input", () => {
    expect(decodeAbort(undefined as any).cause).toBe("unknown")
    expect(decodeAbort(null as any).cause).toBe("unknown")
  })
  it("parses modern three-part form NAME(0xCODE): description", () => {
    const d = decodeAbort("Move abort in 0x1::delegation_pool: EDELEGATOR_ACTIVE_BALANCE_TOO_LOW(0x1000a): Balance is not enough to unlock or reactivate.")
    expect(d.cause).toBe("move_abort")
    expect(d.errorName).toBe("EDELEGATOR_ACTIVE_BALANCE_TOO_LOW")
    expect(d.code).toBe(0x1000a)
    expect(d.category).toBe("invalid argument")
  })
  it("routes empty code after the module colon to the could-not-parse branch", () => {
    const d = decodeAbort("Move abort in 0x1::coin: ")
    expect(d.cause).toBe("move_abort")
    expect(d.code).toBeNull()
    expect(d.category).toBeNull()
    expect(d.reason).toMatch(/could not be parsed/)
    expect(d.reason).not.toMatch(/code 0/)
  })
  it("handles unparseable code strings without throwing", () => {
    const d = decodeAbort("Move abort in 0x1::coin: 0xZZZZ")
    expect(d.cause).toBe("move_abort")
    expect(d.code).toBeNull()
    expect(d.errorName).toBeNull()
    expect(d.reason).toMatch(/could not be parsed/)
  })
  it("never throws across adversarial inputs", () => {
    const inputs = [
      "",
      "banana",
      "0x",
      "-5",
      "Move abort in 0x1::coin:   ",
      "Move abort in 0xABC::m: 0xFFFFFFFFFFFFFFFFFFFF",
      "Move abort in 0x1::coin: 0XDEAD",
      "Move abort in 0x1::coin: 99999999999999999999999999",
      "abc\u0000def",
      "OUT_OF_GAS",
    ]
    for (const s of inputs) {
      const d = decodeAbort(s)
      expect(d).toBeTruthy()
      expect(typeof d.raw).toBe("string")
      expect(d.cause).toBeDefined()
      expect(d.reason.length).toBeGreaterThan(0)
    }
  })
})

// ── The chain names the error. A number in our map must never overrule it. ──

/**
 * A real Decibel failure, mainnet 2026-09-18, tx
 * 0x8f76e4cc2c44c12fb1b960c234d08dbdb4d41c6185222dbbd6eff2753bdf4454
 * (dex_accounts_entry::place_tp_sl_order_for_position).
 *
 * The fullnode reported EINVALID_TRIGGER_PRICE(0x5). Our errmap held code 5 in
 * that module as E_INVALID_REDUCE_ONLY_ORDER, a number that disagreed with both
 * Decibel's docs and the chain, and the decoder matched the NUMBER first. So a
 * trader setting a take-profit was told their reduce-only order was invalid,
 * and the error name the chain itself supplied was overwritten with ours.
 *
 * When the vm_status carries a name, that name is the chain's own statement of
 * what happened. Our map may supply a better explanation for that name; it may
 * never replace the name with a different one.
 */
describe("the name the chain reports outranks a number in our map", () => {
  const MODULE = "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06::pending_order_tracker"
  const REAL = `Move abort in 0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06::pending_order_tracker: EINVALID_TRIGGER_PRICE(0x5): `
  // A map whose code 5 names a DIFFERENT error, which is the shape of the bug.
  const wrongNumber = {
    [MODULE]: {
      5: { name: "E_INVALID_REDUCE_ONLY_ORDER", reason: "The reduce-only order is invalid against your current position." },
    },
  }

  it("keeps the chain's error name", () => {
    const d = decodeAbort(REAL, wrongNumber)
    expect(d.errorName).toBe("EINVALID_TRIGGER_PRICE")
  })

  it("does not give the explanation that belongs to a different error", () => {
    const d = decodeAbort(REAL, wrongNumber)
    expect(d.reason).not.toMatch(/reduce-only/i)
  })

  it("still uses our explanation when the names agree", () => {
    const agreeing = { [MODULE]: { 5: { name: "EINVALID_TRIGGER_PRICE", reason: "The trigger price is on the wrong side of the market." } } }
    const d = decodeAbort(REAL, agreeing)
    expect(d.reason).toBe("The trigger price is on the wrong side of the market.")
  })

  it("still matches by name when the map holds that name under another number", () => {
    const byName = { [MODULE]: { 99: { name: "EINVALID_TRIGGER_PRICE", reason: "Matched by name." } } }
    expect(decodeAbort(REAL, byName).reason).toBe("Matched by name.")
  })

  it("still matches by number when the chain gives no name", () => {
    const bare = `Move abort in ${MODULE}: 0x5`
    expect(decodeAbort(bare, wrongNumber).errorName).toBe("E_INVALID_REDUCE_ONLY_ORDER")
  })
})
