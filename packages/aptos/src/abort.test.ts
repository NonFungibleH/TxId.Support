import { describe, it, expect } from "vitest"
import { decodeAbort } from "./abort"

describe("decodeAbort", () => {
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
