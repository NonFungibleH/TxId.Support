import { describe, it, expect } from "vitest"
import { decodeSolanaError } from "./errors"

// Every payload below is a REAL mainnet failure captured on 2026-09-07.
const JUP = "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4"
const PUMP = "Hd7c1kYHqYJ7dD1bLf9C61XC22JgbGp4P1PQ8UNcUH5w"
const SYS = "11111111111111111111111111111111"

describe("decodeSolanaError", () => {
  it("uses Anchor's own error when Anchor printed one", () => {
    const d = decodeSolanaError({ InstructionError: [3, { Custom: 6004 }] }, [
      "Program log: AnchorError thrown in programs/pump-amm/src/instructions/swap/sell.rs:170. Error Code: ExceededSlippage. Error Number: 6004. Error Message: ExceededSlippage.",
      `Program ${PUMP} failed: custom program error: 0x1774`,
    ])
    expect(d.cause).toBe("program_error")
    expect(d.code).toBe(6004)
    expect(d.errorName).toBe("ExceededSlippage")
    expect(d.unrecognised).toBe(false)
    // CamelCase repeated as the "message" is spaced out rather than shouted.
    expect(d.reason).toMatch(/exceeded slippage/)
  })

  it("prefers a real Anchor message over the name", () => {
    const d = decodeSolanaError({ InstructionError: [1, { Custom: 6003 }] }, [
      "Program log: AnchorError thrown in programs/ocr2/src/lib.rs:639. Error Code: StaleReport. Error Number: 6003. Error Message: Stale report.",
      "Program cjg3oHmg9uuPsP8D6g29NWvhySJkdYdAo9D25PRbKXJ failed: custom program error: 0x1773",
    ])
    expect(d.reason).toContain("Stale report")
  })

  it("names the failing program from the logs, not the err object", () => {
    // The err object says instruction 3; only the logs say it was Jupiter.
    const d = decodeSolanaError({ InstructionError: [3, { Custom: 6001 }] }, [
      `Program ${JUP} invoke [1]`,
      `Program ${JUP} failed: custom program error: 0x1771`,
    ])
    expect(d.program).toBe(JUP)
    expect(d.reason).toContain("Jupiter")
    expect(d.code).toBe(6001)
  })

  // The honest floor: a program's own code with no Anchor log and no map.
  it("refuses to invent a meaning for an unmapped program code", () => {
    const d = decodeSolanaError({ InstructionError: [3, { Custom: 6001 }] }, [
      `Program ${JUP} failed: custom program error: 0x1771`,
    ])
    expect(d.unrecognised).toBe(true)
    expect(d.reason).toMatch(/does not publish a description/)
    expect(d.reason).toContain("0x1771")
    expect(d.reason).toMatch(/defined by the program/)
    expect(d.errorName).toBeNull()
  })

  it("reads Anchor's reserved ranges as a real finding", () => {
    const constraint = decodeSolanaError({ InstructionError: [0, { Custom: 2003 }] }, [])
    expect(constraint.unrecognised).toBe(false)
    expect(constraint.reason).toMatch(/constraint on one of the accounts/)
    const account = decodeSolanaError({ InstructionError: [0, { Custom: 3012 }] }, [])
    expect(account.reason).toMatch(/missing, uninitialised, or owned by the wrong program/)
  })

  it("names the one System program code common enough to be certain about", () => {
    const d = decodeSolanaError({ InstructionError: [3, { Custom: 1 }] }, [`Program ${SYS} failed: custom program error: 0x1`])
    expect(d.cause).toBe("insufficient_funds")
    expect(d.reason).toMatch(/not have enough SOL/)
  })

  it("separates running out of compute from crashing", () => {
    expect(decodeSolanaError({ InstructionError: [2, "ComputationalBudgetExceeded"] }, []).cause).toBe("compute_exceeded")
    const crashed = decodeSolanaError({ InstructionError: [2, "ProgramFailedToComplete"] }, [`Program ${JUP} failed: xyz`])
    expect(crashed.cause).toBe("program_crashed")
    expect(crashed.reason).toContain("Jupiter")
  })

  it("says so rather than guessing when the shape is unfamiliar", () => {
    const d = decodeSolanaError({ SomethingElse: true }, [])
    expect(d.cause).toBe("unknown")
    expect(d.unrecognised).toBe(true)
    expect(d.reason).toMatch(/does not recognise/)
  })

  it("never throws, whatever it is handed", () => {
    for (const junk of [null, undefined, "", 42, [], { InstructionError: [] }, { InstructionError: [0, null] }]) {
      expect(() => decodeSolanaError(junk, [])).not.toThrow()
    }
  })
})
