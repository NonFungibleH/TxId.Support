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
  it("never invents a category for large raw u64 codes", () => {
    const d = decodeAbort("Move abort in 0xabc::vault: 18446744073709551615")
    expect(d.category).toBeNull()
    expect(d.code).toBeNull() // exceeds MAX_SAFE_INTEGER — kept only in raw/reason
    expect(d.reason).toMatch(/18446744073709551615/)
  })
})
