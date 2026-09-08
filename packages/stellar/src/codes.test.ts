import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { CODE_NAMES, EXPLAINED_CONSTANTS, OPERATION_TYPES, RESULT_CODE_ENUM_FOR_OP, SUCCESS_PAYLOAD_BYTES, codeName, explain } from "./codes"

interface Harvest {
  enums: Record<string, { name: string; values: Record<string, string> }>
  operationTypes: Record<string, string>
  resultEnumForOperation: Record<string, string>
  successPayloadBytes: Record<string, number>
}

const h = JSON.parse(readFileSync(join(__dirname, "../scripts/result-codes.json"), "utf8")) as Harvest

/**
 * The names and numbers are Stellar's, harvested from its own XDR. The English
 * is ours. This is the guard that keeps those two facts true, so a Stellar
 * protocol change that renumbers a code fails here rather than mistranslating
 * somebody's failed payment.
 */
describe("the generated tables agree with Stellar's XDR", () => {
  it("harvested something to check against", () => {
    expect(Object.keys(h.enums).length).toBeGreaterThanOrEqual(28)
    expect(Object.keys(h.operationTypes).length).toBeGreaterThanOrEqual(27)
  })

  it("carries every enum and every code", () => {
    for (const [name, e] of Object.entries(h.enums)) {
      for (const [v, constant] of Object.entries(e.values)) {
        expect(CODE_NAMES[name]?.[Number(v)]).toBe(constant)
      }
    }
  })

  it("maps every operation type to a result enum that exists", () => {
    for (const constant of Object.values(h.operationTypes)) {
      const enumName = RESULT_CODE_ENUM_FOR_OP[constant]
      expect(enumName, `no result enum for ${constant}`).toBeTruthy()
      expect(CODE_NAMES[enumName!], `${enumName} has no codes`).toBeTruthy()
    }
  })

  // The XDR reuses ManageSellOfferResult for CREATE_PASSIVE_SELL_OFFER and
  // spells ExtendFootprintTTLResult with TTL capitalised, so this mapping is
  // read out of `union OperationResult` and must never be derived from names.
  it("keeps the two pairings a naming rule would get wrong", () => {
    expect(RESULT_CODE_ENUM_FOR_OP["CREATE_PASSIVE_SELL_OFFER"]).toBe("ManageSellOfferResultCode")
    expect(RESULT_CODE_ENUM_FOR_OP["EXTEND_FOOTPRINT_TTL"]).toBe("ExtendFootprintTTLResultCode")
  })

  // txFAILED and opINNER carry a lowercase prefix in the XDR. An earlier version
  // of the harvester required an uppercase first character and truncated both,
  // which silently made txBAD_AUTH and opBAD_AUTH the same key.
  it("keeps the prefixed constant names intact", () => {
    expect(codeName("TransactionResultCode", -1)).toBe("txFAILED")
    expect(codeName("OperationResultCode", 0)).toBe("opINNER")
    expect(codeName("TransactionResultCode", -6)).toBe("txBAD_AUTH")
    expect(codeName("OperationResultCode", -1)).toBe("opBAD_AUTH")
  })

  it("has a success payload size for every operation, defaulting to variable", () => {
    for (const constant of Object.values(h.operationTypes)) {
      expect(SUCCESS_PAYLOAD_BYTES[constant], `no size for ${constant}`).toBeTypeOf("number")
    }
    // The six that carry a variable-length array of crossed offers.
    for (const dex of ["PATH_PAYMENT_STRICT_SEND", "PATH_PAYMENT_STRICT_RECEIVE", "MANAGE_SELL_OFFER", "MANAGE_BUY_OFFER", "CREATE_PASSIVE_SELL_OFFER", "INFLATION"]) {
      expect(SUCCESS_PAYLOAD_BYTES[dex], dex).toBeLessThan(0)
    }
    expect(SUCCESS_PAYLOAD_BYTES["PAYMENT"]).toBe(0)
    expect(SUCCESS_PAYLOAD_BYTES["ACCOUNT_MERGE"]).toBe(8)
    expect(SUCCESS_PAYLOAD_BYTES["INVOKE_HOST_FUNCTION"]).toBe(32)
    expect(SUCCESS_PAYLOAD_BYTES["CREATE_CLAIMABLE_BALANCE"]).toBe(36)
  })

  it("reads OPERATION_TYPES by discriminant", () => {
    expect(OPERATION_TYPES[1]).toBe("PAYMENT")
    expect(OPERATION_TYPES[13]).toBe("PATH_PAYMENT_STRICT_SEND")
    expect(OPERATION_TYPES[24]).toBe("INVOKE_HOST_FUNCTION")
  })
})

describe("every sentence we hold is attached to a code Stellar actually defines", () => {
  const known = new Set<string>()
  for (const e of Object.values(h.enums)) for (const c of Object.values(e.values)) known.add(c)

  it("has no explanation for a constant that does not exist", () => {
    const orphans = EXPLAINED_CONSTANTS.filter(c => !known.has(c))
    expect(orphans).toEqual([])
  })

  it("covers the codes that actually occur on mainnet", () => {
    // Measured 2026-09-08: these are 98% of live failures between them.
    for (const c of [
      "PATH_PAYMENT_STRICT_RECEIVE_OVER_SENDMAX",
      "PATH_PAYMENT_STRICT_SEND_UNDER_DESTMIN",
      "PATH_PAYMENT_STRICT_RECEIVE_TOO_FEW_OFFERS",
      "PAYMENT_UNDERFUNDED",
      "SET_TRUST_LINE_FLAGS_NO_TRUST_LINE",
      "CLAIM_CLAIMABLE_BALANCE_NO_TRUST",
      "CREATE_CLAIMABLE_BALANCE_NO_TRUST",
      "LIQUIDITY_POOL_DEPOSIT_UNDERFUNDED",
      "MANAGE_SELL_OFFER_UNDERFUNDED",
      "SET_OPTIONS_LOW_RESERVE",
      "INVOKE_HOST_FUNCTION_TRAPPED",
    ]) {
      expect(explain(c), c).toBeTruthy()
    }
  })

  it("returns null rather than a guess for an unexplained code", () => {
    expect(explain("INFLATION_NOT_TIME")).toBeNull()
    expect(explain(null)).toBeNull()
    expect(explain("NOT_A_REAL_CONSTANT")).toBeNull()
  })
})

describe("house rules the explanations have to keep", () => {
  const all = EXPLAINED_CONSTANTS.map(c => explain(c)!).filter(Boolean)

  it("uses no em dashes", () => {
    expect(all.filter(t => /[—–]/.test(t))).toEqual([])
  })

  it("never offers advice or reassurance about funds", () => {
    const banned = /\b(you should (buy|sell|swap|hold)|your funds are safe|don't worry|guaranteed)\b/i
    expect(all.filter(t => banned.test(t))).toEqual([])
  })

  it("explains the three Stellar concepts a user will not know", () => {
    const joined = all.join(" ")
    expect(joined).toMatch(/trustline/i)
    expect(joined).toMatch(/reserve/i)
    expect(joined).toMatch(/time bound|expired/i)
  })
})
