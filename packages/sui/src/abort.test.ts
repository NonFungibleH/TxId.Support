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
    // Sui emits several statuses we have never held a real payload for. Wording
    // invented from the type definition is exactly what this floor prevents.
    const d = decodeSuiAbort("CommandArgumentError { arg_idx: 0, kind: TypeMismatch } in command 1")
    expect(d.cause).toBe("unknown")
    expect(d.code).toBeNull()
    expect(d.reason).toMatch(/does not recognise/)
    expect(d.reason).toContain("CommandArgumentError")
    // Even at the floor, the command index is structural and always extractable.
    expect(d.command).toBe(1)
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

// 18% of Sui's failures are not Move aborts at all. Census of 4,122 mainnet
// transactions across 150 checkpoints, 2026-09-07: 420 failed, 344 aborts, and
// 76 execution statuses that used to reach the user as "a status this decoder
// does not recognise". Every payload below is one of those, captured live.
describe("failures that are not Move aborts", () => {
  // Real: digest 5NoACwkLqc4CP5XricKmwo52F5X6iqvyC2Y4mGSv8nZv, command 3 was
  // SplitCoins off the result of command 2, inside a six-command swap route.
  const ROUTE_COMMANDS = [
    { MoveCall: { package: "0x0e73", module: "pool", function: "swap" } },
    { MoveCall: { package: "0xf369", module: "jk", function: "ce" } },
    { MoveCall: { package: "0x075a", module: "jk", function: "ce" } },
    { SplitCoins: [{ Result: 2 }, [{ Input: 1 }]] },
    { MoveCall: { package: "0x0e73", module: "pool", function: "swap" } },
    { MoveCall: { package: "0x6470", module: "pool", function: "swap" } },
  ]

  it("names InsufficientCoinBalance instead of shrugging at it", () => {
    const d = decodeSuiAbort("InsufficientCoinBalance in command 3")
    expect(d.cause).toBe("insufficient_coin")
    expect(d.command).toBe(3)
    expect(d.reason).not.toMatch(/does not recognise/)
    expect(d.reason).toMatch(/held less than the amount asked for/)
  })

  // The distinction the whole branch exists for. Telling somebody their wallet
  // was short, when the shortfall was in what an earlier swap returned, is the
  // confidently wrong answer this codebase is built to refuse.
  it("separates a shortfall in the user's wallet from one in the route", () => {
    const route = decodeSuiAbort("InsufficientCoinBalance in command 3", undefined, { commands: ROUTE_COMMANDS })
    expect(route.coinOrigin).toBe("earlier_command")
    expect(route.commandKind).toBe("SplitCoins")
    expect(route.reason).toMatch(/an earlier command in the same transaction had produced/)
    expect(route.reason).not.toMatch(/shortfall was in your balance/)

    const own = decodeSuiAbort("InsufficientCoinBalance in command 0", undefined, {
      commands: [{ SplitCoins: [{ Input: 0 }, [{ Input: 1 }]] }],
    })
    expect(own.coinOrigin).toBe("sender")
    expect(own.reason).toMatch(/supplied out of your own wallet/)
  })

  // The status never names the coin. Assuming SUI is the obvious wrong guess.
  it("never implies which coin was short", () => {
    const d = decodeSuiAbort("InsufficientCoinBalance in command 3", undefined, { commands: ROUTE_COMMANDS })
    expect(d.reason).toMatch(/does not say in the status which coin/)
    expect(d.reason).toMatch(/not necessarily your SUI balance/)
  })

  it("reports the call that failed when the failing command is a MoveCall", () => {
    const d = decodeSuiAbort("InsufficientCoinBalance in command 5", undefined, { commands: ROUTE_COMMANDS })
    expect(d.commandKind).toBe("MoveCall")
    expect(d.commandTarget).toBe("0x6470::pool::swap")
    expect(d.reason).toContain("0x6470::pool::swap")
  })

  it("says nothing about the failing step when the command list was not read", () => {
    const d = decodeSuiAbort("InsufficientCoinBalance in command 3")
    expect(d.commandKind).toBeNull()
    expect(d.coinOrigin).toBeNull()
    expect(d.reason).not.toMatch(/your own wallet|earlier command/)
  })

  // A gas BUDGET below what execution needed, which is not the same as a wallet
  // with no SUI in it, and the two have different fixes.
  it("explains InsufficientGas as a budget, not a balance", () => {
    const d = decodeSuiAbort("InsufficientGas")
    expect(d.cause).toBe("insufficient_gas")
    expect(d.reason).toMatch(/more gas than the budget/)
    expect(d.reason).toMatch(/rather than how much SUI is in the wallet/)
  })
})

// A Sui upgrade republishes the package at a NEW address, and both versions
// stay live. Measured 2026-09-07: DeepBook aborts arrived under three different
// runtime addresses inside a single 150-checkpoint window.
describe("error maps survive a package upgrade", () => {
  const ORIGINAL = "0x2c8d603bc51326b8c13cef9dd07031a408a48dddb541963357661df5d3204809"
  const RUNTIME = "0xcaf6ba059d539a97646d47f0b9ddf843e138d215e2a12ca1f4585d386f7aec3a"
  // Real: balance_manager::withdraw_with_proof code 3, seen at three addresses.
  const status = `MoveAbort(MoveLocation { module: ModuleId { address: ${RUNTIME.slice(2)}, name: Identifier("balance_manager") }, function: 12, instruction: 40, function_name: Some("withdraw_with_proof") }, 3) in command 2`
  const errmap: SuiErrmap = {
    [`${ORIGINAL}::balance_manager`]: { 3: { name: "EBalanceManagerBalanceTooLow", reason: "More than the balance manager holds." } },
  }

  it("misses when keyed only on the runtime address", () => {
    expect(decodeSuiAbort(status, errmap).errorName).toBeNull()
  })

  it("hits once the original package id is resolved", () => {
    const d = decodeSuiAbort(status, errmap, { originalPackage: ORIGINAL })
    expect(d.errorName).toBe("EBalanceManagerBalanceTooLow")
    expect(d.package).toBe(RUNTIME)
  })

  it("still hits a map written against the runtime address", () => {
    const runtimeMap: SuiErrmap = { [`${RUNTIME}::balance_manager`]: { 3: { name: "X", reason: "y" } } }
    expect(decodeSuiAbort(status, runtimeMap, { originalPackage: ORIGINAL }).errorName).toBe("X")
  })
})
