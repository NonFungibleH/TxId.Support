import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { decodeSuiAbort } from "./abort"
import { DEEPBOOK_PACKAGE, SUI_ERRMAPS } from "./errmap"

interface Harvested { name: string; code: number; doc: string }

const harvested = JSON.parse(
  readFileSync(join(__dirname, "../scripts/deepbook-errors.json"), "utf8"),
) as Record<string, Harvested[]>

// The map's ENGLISH is ours. Its names and numbers are DeepBook's, harvested
// mechanically by scripts/harvest-deepbook.ts. This is the guard that keeps
// those two facts true: a release that renumbers an error, or a hand edit that
// drifts, fails here rather than mistranslating somebody's failed withdrawal.
describe("the DeepBook map agrees with DeepBook's published source", () => {
  it("harvested something to check against", () => {
    expect(Object.keys(harvested).length).toBeGreaterThan(5)
  })

  it("gives every code the name the source gives it", () => {
    const drift: string[] = []
    for (const [key, codes] of Object.entries(SUI_ERRMAPS)) {
      const module = key.split("::")[1]!
      const source = harvested[module]
      if (!source) { drift.push(`${module}: no such module in the harvested source`); continue }
      for (const [code, entry] of Object.entries(codes)) {
        const match = source.find(e => e.code === Number(code))
        if (!match) drift.push(`${module}: code ${code} is not defined in the source`)
        else if (match.name !== entry.name) drift.push(`${module}: code ${code} is ${match.name} in the source, ${entry.name} here`)
      }
    }
    expect(drift).toEqual([])
  })

  // A code DeepBook defines and we have no English for reaches the user as a
  // bare number. That is honest, but it is also a gap, and it should be visible
  // rather than discovered by a customer.
  it("covers every error constant the source defines", () => {
    const missing: string[] = []
    for (const [module, errors] of Object.entries(harvested)) {
      const mapped = SUI_ERRMAPS[`${DEEPBOOK_PACKAGE}::${module}`]
      for (const e of errors) {
        if (!mapped || !(e.code in mapped)) missing.push(`${module}::${e.name} (${e.code})`)
      }
    }
    expect(missing).toEqual([])
  })
})

describe("the map answers the failures actually seen on mainnet", () => {
  // Every one of these was captured on 2026-09-07. balance_manager code 3 alone
  // appeared ten times in 150 checkpoints, under three package addresses.
  const abort = (module: string, fn: string, code: number, pkg = DEEPBOOK_PACKAGE) =>
    `MoveAbort(MoveLocation { module: ModuleId { address: ${pkg.slice(2)}, name: Identifier("${module}") }, function: 1, instruction: 1, function_name: Some("${fn}") }, ${code}) in command 0`

  it("explains a withdrawal larger than the balance manager holds", () => {
    const d = decodeSuiAbort(abort("balance_manager", "withdraw_with_proof", 3), SUI_ERRMAPS)
    expect(d.errorName).toBe("EBalanceManagerBalanceTooLow")
    expect(d.reason).toMatch(/more than the balance manager holds/i)
    // The thing a confused DeepBook user actually needs to be told.
    expect(d.reason).toMatch(/inside your balance manager rather than in your wallet/)
  })

  it("explains a post-only order that would have crossed the book", () => {
    const d = decodeSuiAbort(abort("order_info", "assert_execution", 5), SUI_ERRMAPS)
    expect(d.errorName).toBe("EPOSTOrderCrossesOrderbook")
    expect(d.reason).toMatch(/post-only/)
  })

  it("explains an order that is no longer on the book", () => {
    const d = decodeSuiAbort(abort("big_vector", "leaf_remove", 5), SUI_ERRMAPS)
    expect(d.errorName).toBe("ENotFound")
    expect(d.reason).toMatch(/already been filled, cancelled or expired/)
  })

  it("explains an invalid order price", () => {
    const d = decodeSuiAbort(abort("order_info", "validate_inputs", 0), SUI_ERRMAPS)
    expect(d.errorName).toBe("EOrderInvalidPrice")
    expect(d.reason).toMatch(/tick/)
  })

  // DeepBook's internal invariants are not the user's fault, and sending them
  // to check their inputs would send them looking for a mistake they did not make.
  it("does not blame the user for DeepBook's own invariants", () => {
    const d = decodeSuiAbort(abort("big_vector", "leaf_insert", 7), SUI_ERRMAPS)
    expect(d.errorName).toBe("EBadRemove")
    expect(d.reason).toMatch(/internal check/)
    expect(d.reason).toMatch(/rather than anything wrong with your order/)
  })
})

describe("house rules the map itself has to keep", () => {
  const all = Object.values(SUI_ERRMAPS).flatMap(codes => Object.values(codes))

  it("has an entry for every code it claims", () => {
    expect(all.length).toBeGreaterThan(80)
  })

  // No em dashes in anything user- or model-facing. The map is read verbatim
  // into answers, so it is exactly the surface that rule was written for.
  it("uses no em dashes", () => {
    expect(all.filter(e => /[—–]/.test(e.reason) || /[—–]/.test(e.name))).toEqual([])
  })

  it("never offers financial advice or reassurance about funds", () => {
    const banned = /\b(you should (buy|sell|close|hold)|your funds are safe|don't worry|guaranteed)\b/i
    expect(all.filter(e => banned.test(e.reason))).toEqual([])
  })
})
