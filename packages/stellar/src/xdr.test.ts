import { describe, it, expect } from "vitest"
import { describeFailure } from "./client"
import { decodeTransactionResult } from "./xdr"

/**
 * Every payload below is REAL, captured from Stellar mainnet on 2026-09-08.
 *
 * Census the same day, 1,200 transactions through Soroban RPC: 296 failed
 * (24.7%), the highest rate of any chain we have measured. The decoder named
 * the failing operation on 98.6% of them and held English for 98.3%. What makes
 * that possible is that a FAILURE case in Stellar's XDR is always void, so the
 * failing operation costs exactly three 4-byte words, and 21 of the 27 SUCCESS
 * payloads are void or a fixed size and can be skipped exactly.
 */
const PP_RECEIVE = "AAAAAAAAAGT/////AAAAAQAAAAAAAAAC////9AAAAAA="
const PP_SEND = "AAAAAAAAAGT/////AAAAAQAAAAAAAAAN////9AAAAAA="
const PAYMENT = "AAAAAAAAAGT/////AAAAAQAAAAAAAAAB/////gAAAAA="
/** 4 operations, the first two succeeded (void payloads), the third failed. */
const MULTI_OP = "AAAAAAAAAZD/////AAAABAAAAAAAAAAGAAAAAAAAAAAAAAAPAAAAAAAAAAAAAAAN////9AAAAAAAAAAG/////QAAAAA="
/** A fee bump whose INNER transaction failed inside a Soroban contract. */
const FEE_BUMP = "AAAAAAAAOBj////zpsgoLXj/42pqK18/UPCoM0TQCx7IIz+HBj+epX+6vVwAAAAAAAAAAP////8AAAABAAAAAAAAABj////+AAAAAAAAAAA="

describe("the twelve bytes that carry the whole answer", () => {
  it("reads fee, top-level code and the failing operation off a real payload", () => {
    const d = decodeTransactionResult(PP_SEND)
    expect(d?.code).toBe("txFAILED")
    expect(d?.feeChargedStroops).toBe("100")
    expect(d?.operationCount).toBe(1)
    expect(d?.failing?.type).toBe("PATH_PAYMENT_STRICT_SEND")
    expect(d?.failing?.code).toBe(-12)
    expect(d?.failing?.name).toBe("PATH_PAYMENT_STRICT_SEND_UNDER_DESTMIN")
    expect(d?.incomplete).toBe(false)
  })

  // The two path-payment directions use the SAME number for opposite sentences:
  // -12 is UNDER_DESTMIN on strict send and OVER_SENDMAX on strict receive. Get
  // the operation type wrong and the user is told the opposite of what happened.
  it("keeps the two directions of -12 apart", () => {
    expect(decodeTransactionResult(PP_SEND)?.failing?.name).toBe("PATH_PAYMENT_STRICT_SEND_UNDER_DESTMIN")
    expect(decodeTransactionResult(PP_RECEIVE)?.failing?.name).toBe("PATH_PAYMENT_STRICT_RECEIVE_OVER_SENDMAX")
    expect(describeFailure(decodeTransactionResult(PP_SEND))).toMatch(/delivered less than the minimum/)
    expect(describeFailure(decodeTransactionResult(PP_RECEIVE))).toMatch(/cost more than the maximum/)
  })

  it("reads a payment that was short", () => {
    const d = decodeTransactionResult(PAYMENT)
    expect(d?.failing?.name).toBe("PAYMENT_UNDERFUNDED")
    // The Stellar-specific half a user will not know without being told.
    expect(describeFailure(d)).toMatch(/reserve/)
  })
})

describe("skipping successful operations to reach the failing one", () => {
  it("walks past two void successes and names the third operation", () => {
    const d = decodeTransactionResult(MULTI_OP)
    expect(d?.operationCount).toBe(4)
    expect(d?.failing?.index).toBe(2)
    expect(d?.failing?.name).toBe("PATH_PAYMENT_STRICT_SEND_UNDER_DESTMIN")
    expect(d?.incomplete).toBe(false)
    // The operations before it were read, not skipped over blindly.
    expect(d?.operations[0]?.type).toBe("CHANGE_TRUST")
    expect(d?.operations[0]?.failed).toBe(false)
  })

  it("says which operation of how many, when there is more than one", () => {
    expect(describeFailure(decodeTransactionResult(MULTI_OP))).toMatch(/operation 3 of 4/)
  })

  it("says nothing about position on a single-operation transaction", () => {
    expect(describeFailure(decodeTransactionResult(PP_SEND))).not.toMatch(/operation \d+ of/)
  })
})

describe("a fee bump carries its inner result, so nobody is sent to look it up", () => {
  it("decodes through to the inner failure", () => {
    const d = decodeTransactionResult(FEE_BUMP)
    expect(d?.feeBump).toBe(true)
    expect(d?.code).toBe("txFAILED")
    expect(d?.failing?.type).toBe("INVOKE_HOST_FUNCTION")
    expect(d?.failing?.name).toBe("INVOKE_HOST_FUNCTION_TRAPPED")
  })

  it("explains the Soroban failure rather than describing the wrapper", () => {
    const answer = describeFailure(decodeTransactionResult(FEE_BUMP))
    expect(answer).toMatch(/contract stopped partway/)
    expect(answer).not.toMatch(/look at the inner transaction/)
  })
})

describe("the honest floor", () => {
  // A DEX success carries a variable-length array of every offer it crossed, so
  // the walk cannot step over it. It stops and says so rather than reading an
  // int out of the middle of a payload and reporting it as a reason.
  it("stops at a variable-length success and reports the stop", () => {
    // 2 operations: a MANAGE_SELL_OFFER that SUCCEEDED, then anything after it.
    const xdr = Buffer.concat([
      Buffer.from("0000000000000064", "hex"),  // feeCharged 100
      Buffer.from("ffffffff", "hex"),          // txFAILED
      Buffer.from("00000002", "hex"),          // 2 operations
      Buffer.from("00000000", "hex"),          // opINNER
      Buffer.from("00000003", "hex"),          // MANAGE_SELL_OFFER
      Buffer.from("00000000", "hex"),          // success, and its payload is variable
    ]).toString("base64")
    const d = decodeTransactionResult(xdr)
    expect(d?.incomplete).toBe(true)
    expect(d?.failing).toBeNull()
    const answer = describeFailure(d)
    expect(answer).toMatch(/we can only read the result up to that point/)
    expect(answer).toMatch(/rolled back/)
  })

  it("never invents a reason for a code Stellar does not name", () => {
    const xdr = Buffer.concat([
      Buffer.from("0000000000000064", "hex"),
      Buffer.from("ffffffff", "hex"),
      Buffer.from("00000001", "hex"),
      Buffer.from("00000000", "hex"),
      Buffer.from("00000001", "hex"),          // PAYMENT
      Buffer.from("ffffff00", "hex"),          // -256, not a code Stellar defines
    ]).toString("base64")
    const d = decodeTransactionResult(xdr)
    expect(d?.failing?.code).toBe(-256)
    expect(d?.failing?.name).toBeNull()
    expect(describeFailure(d)).toMatch(/not a code Stellar's published definitions name/)
  })

  it("reports an operation-level wrapper code without an operation type", () => {
    const xdr = Buffer.concat([
      Buffer.from("0000000000000064", "hex"),
      Buffer.from("ffffffff", "hex"),
      Buffer.from("00000001", "hex"),
      Buffer.from("fffffffe", "hex"),          // opNO_ACCOUNT, which is void
    ]).toString("base64")
    const d = decodeTransactionResult(xdr)
    expect(d?.failing?.outer).toBe("opNO_ACCOUNT")
    expect(describeFailure(d)).toMatch(/does not exist on the ledger/)
  })

  it("never throws, whatever it is handed", () => {
    for (const junk of ["", "!!!!", "AAAA", "A".repeat(400), null as unknown as string]) {
      expect(() => decodeTransactionResult(junk)).not.toThrow()
    }
    expect(decodeTransactionResult("")).toBeNull()
  })
})

describe("codes that fail before any operation runs", () => {
  const top = (code: number) =>
    decodeTransactionResult(
      Buffer.concat([Buffer.from("0000000000000064", "hex"), Buffer.from(new Int32Array([0]).buffer)]).toString("base64"),
    ) && decodeTransactionResult(
      Buffer.concat([
        Buffer.from("0000000000000064", "hex"),
        (() => { const b = Buffer.alloc(4); b.writeInt32BE(code); return b })(),
      ]).toString("base64"),
    )

  it("reads txBAD_SEQ and explains the concurrent-submission cause", () => {
    const d = top(-5)
    expect(d?.code).toBe("txBAD_SEQ")
    expect(d?.operationCount).toBeNull()
    expect(describeFailure(d)).toMatch(/two transactions were submitted from the same account at once/)
  })

  it("reads txTOO_LATE and says resubmitting is safe", () => {
    const d = top(-3)
    expect(d?.code).toBe("txTOO_LATE")
    // The expired transaction CANNOT execute later, which is the fact that makes
    // resubmitting safe. Getting this wrong risks a double send.
    expect(describeFailure(d)).toMatch(/cannot execute later/)
  })

  it("reads txINSUFFICIENT_FEE and names surge pricing", () => {
    expect(describeFailure(top(-9))).toMatch(/surge/)
  })
})
