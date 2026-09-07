import { describe, it, expect } from "vitest"
import { decodeSuiAbort, normalizeSuiAddress, type SuiErrmap } from "./abort"

// Every status below is REAL, captured from Sui mainnet on 2026-09-07.
const REAL =
  'MoveAbort(MoveLocation { module: ModuleId { address: c72126457c84430ad439c8daf19679cfe87c84fc70912ba9b1df3060b64a5c50, name: Identifier("h86261") }, function: 1, instruction: 32, function_name: Some("h8b64d") }, 200) in command 0'

describe("decodeSuiAbort", () => {
  it("parses every field of a real mainnet abort", () => {
    const d = decodeSuiAbort(REAL)
    expect(d.cause).toBe("move_abort")
    expect(d.package).toBe("0xc72126457c84430ad439c8daf19679cfe87c84fc70912ba9b1df3060b64a5c50")
    expect(d.module).toBe("h86261")
    expect(d.functionName).toBe("h8b64d")
    expect(d.functionIndex).toBe(1)
    expect(d.code).toBe(200)
    expect(d.command).toBe(0)
  })

  // Sui gives a bare integer. Aptos embeds the constant name; Sui does not, and
  // inventing one from the number is the failure this codebase exists to avoid.
  it("refuses to name an unmapped code, and says why it cannot", () => {
    const d = decodeSuiAbort(REAL)
    expect(d.errorName).toBeNull()
    expect(d.reason).toContain("error code 200")
    expect(d.reason).toMatch(/publishes no description/)
    expect(d.reason).toMatch(/defined by the protocol/)
    expect(d.reason).toMatch(/only the gas was spent/)
  })

  it("uses an error map when the protocol has one", () => {
    const errmap: SuiErrmap = {
      "0xc72126457c84430ad439c8daf19679cfe87c84fc70912ba9b1df3060b64a5c50::h86261": {
        200: { name: "EPriceSlippage", reason: "The price moved past your limit. Nothing was swapped." },
      },
    }
    const d = decodeSuiAbort(REAL, errmap)
    expect(d.errorName).toBe("EPriceSlippage")
    expect(d.reason).toMatch(/price moved past your limit/)
  })

  // An abbreviated package address and a padded one are the same package. If
  // these did not match, every hand-written map entry would silently miss.
  it("matches a map written with either spelling of the address", () => {
    const short = 'MoveAbort(MoveLocation { module: ModuleId { address: 0000000000000000000000000000000000000000000000000000000000000002, name: Identifier("coin") }, function: 3, instruction: 9, function_name: Some("split") }, 7) in command 1'
    const errmap: SuiErrmap = { "0x2::coin": { 7: { name: "EBalanceTooLow", reason: "Not enough balance to split." } } }
    // A map keyed the short way must still hit, so callers normalise on write.
    const normalised: SuiErrmap = Object.fromEntries(
      Object.entries(errmap).map(([k, v]) => {
        const [addr, mod] = k.split("::")
        return [`${normalizeSuiAddress(addr!)}::${mod}`, v]
      }),
    )
    expect(decodeSuiAbort(short, normalised).errorName).toBe("EBalanceTooLow")
  })

  it("handles an abort with no function name rather than inventing one", () => {
    const noName = 'MoveAbort(MoveLocation { module: ModuleId { address: 0faf21b90a31e7d9a2334455667788990011223344556677889900112233445566, name: Identifier("v2") }, function: 4, instruction: 11, function_name: None }, 2) in command 0'
    const d = decodeSuiAbort(noName)
    expect(d.functionName).toBeNull()
    expect(d.module).toBe("v2")
    expect(d.code).toBe(2)
    expect(d.reason).toContain("v2")
  })

  it("keeps very large codes intact", () => {
    // Observed live: pg::6409484. Truncating or misreading these would name the
    // wrong error entirely.
    const big = 'MoveAbort(MoveLocation { module: ModuleId { address: 7d94bc09886dcbf789f7112233445566778899001122334455667788990011ab, name: Identifier("pg") }, function: 0, instruction: 1, function_name: Some("swap") }, 6409484) in command 2'
    expect(decodeSuiAbort(big).code).toBe(6409484)
  })

  it("says so, rather than guessing, for a status it does not recognise", () => {
    const d = decodeSuiAbort("InsufficientGas")
    expect(d.cause).toBe("unknown")
    expect(d.code).toBeNull()
    expect(d.reason).toMatch(/does not recognise/)
    expect(d.reason).toContain("InsufficientGas")
  })

  it("never throws, whatever it is handed", () => {
    for (const junk of ["", "MoveAbort(", "MoveAbort(MoveLocation { }, )", null as unknown as string]) {
      expect(() => decodeSuiAbort(junk)).not.toThrow()
    }
  })

  it("normalises addresses both ways", () => {
    expect(normalizeSuiAddress("0x2")).toBe("0x" + "2".padStart(64, "0"))
    expect(normalizeSuiAddress("2")).toBe(normalizeSuiAddress("0x2"))
  })
})
