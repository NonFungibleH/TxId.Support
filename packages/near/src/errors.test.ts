import { describe, it, expect } from "vitest"
import { decodeNearError, stripPanic } from "./errors"
import { MAPPED_CONTRACTS, PROTOCOL_ERRORS } from "./errmap"

/**
 * Every payload below is REAL, captured from NEAR mainnet on 2026-09-08.
 *
 * Census the same day: 149 transactions, 40 failed (26.8%), the highest rate of
 * any chain we have measured. All 40 arrived as one shape,
 * ActionError/FunctionCallError/ExecutionError, and 21 of them were a single
 * cause: Ref Finance E68.
 */
const REF_E68 = { ActionError: { index: 0, kind: { FunctionCallError: {
  ExecutionError: "Smart contract panicked: panicked at 'E68: slippage error', ref-exchange/src/simple_pool.rs:313:9" } } } }
const HOT_SUPPLY = { ActionError: { index: 0, kind: { FunctionCallError: {
  ExecutionError: "Smart contract panicked: panicked at game_contract/src/lib.rs:439:9:\nMax supply reached" } } } }
const INTENT = { ActionError: { index: 0, kind: { FunctionCallError: {
  ExecutionError: "Smart contract panicked: invalid intent" } } } }

describe("the Rust panic machinery never reaches a user", () => {
  /**
   * Rust changed its panic format at 1.72 and near-sdk adds its own prefix, so
   * the SAME failure arrives in three shapes. All three were observed in one
   * 40-failure window, which is why this is a list of patterns rather than one.
   */
  it("strips the pre-1.72 quoted form", () => {
    expect(stripPanic("Smart contract panicked: panicked at 'E68: slippage error', ref-exchange/src/simple_pool.rs:313:9"))
      .toBe("E68: slippage error")
  })

  it("strips the post-1.72 trailing form", () => {
    expect(stripPanic("Smart contract panicked: panicked at game_contract/src/lib.rs:439:9:\nMax supply reached"))
      .toBe("Max supply reached")
  })

  it("strips the bare near-sdk form", () => {
    expect(stripPanic("Smart contract panicked: invalid intent")).toBe("invalid intent")
  })

  // A user must never see the contract author's file layout. It looks like an
  // internal error rather than something they did, and it is the part most
  // likely to make somebody think the protocol is broken when their swap just
  // moved on price.
  it("leaves no source path anywhere in the answer", () => {
    for (const f of [REF_E68, HOT_SUPPLY, INTENT]) {
      const d = decodeNearError(f, "v2.ref-finance.near")
      expect(d.reason).not.toMatch(/\.rs:\d+/)
      expect(d.reason).not.toMatch(/panicked at/)
      expect(d.message ?? "").not.toMatch(/\.rs:\d+/)
    }
  })
})

describe("the failure that matters most on NEAR", () => {
  // 21 of 40 live failures, 52%. The user is shown "E68" and told nothing.
  it("translates Ref's E68 into what actually happened", () => {
    const d = decodeNearError(REF_E68, "v2.ref-finance.near")
    expect(d.cause).toBe("contract_panic")
    expect(d.code).toBe("E68")
    expect(d.unrecognised).toBe(false)
    expect(d.reason).toMatch(/price moved/)
    expect(d.reason).toMatch(/only the gas was spent/)
  })

  /**
   * A code is only meaningful inside the contract that defined it. E68 is Ref's;
   * the same string from another contract means nothing to us and must take the
   * honest middle rather than borrow Ref's sentence.
   */
  it("does not apply one protocol's codes to another", () => {
    const d = decodeNearError(REF_E68, "some-other-dex.near")
    expect(d.unrecognised).toBe(true)
    expect(d.reason).not.toMatch(/price moved/)
    // It still quotes the contract's own words, which is NEAR's advantage.
    expect(d.reason).toMatch(/E68: slippage error/)
  })
})

describe("the honest middle, which is higher on NEAR than anywhere else", () => {
  /**
   * On every other chain an unmapped failure yields a bare number. Here the
   * contract gave a sentence, so an unmapped failure still quotes it. That is
   * why NEAR's floor beats Sui's and Solana's.
   */
  it("quotes the contract's own words when we hold no translation", () => {
    const d = decodeNearError(HOT_SUPPLY, "game.hot.tg")
    expect(d.unrecognised).toBe(true)
    expect(d.message).toBe("Max supply reached")
    expect(d.reason).toMatch(/"Max supply reached"/)
    expect(d.reason).toMatch(/game\.hot\.tg/)
  })

  it("never claims a reason when the contract gave none", () => {
    const d = decodeNearError({ ActionError: { index: 0, kind: { FunctionCallError: { ExecutionError: "" } } } }, "x.near")
    expect(d.cause).toBe("unrecognised")
    expect(d.message).toBeNull()
    expect(d.reason).toMatch(/without giving a readable reason/)
  })

  it("states an action-level name it holds no wording for, rather than inventing one", () => {
    const d = decodeNearError({ ActionError: { index: 1, kind: { SomeFutureThing: {} } } }, "x.near")
    expect(d.unrecognised).toBe(true)
    expect(d.reason).toMatch(/SomeFutureThing/)
    expect(d.reason).toMatch(/runtime's own wording/)
  })

  it("never throws, whatever it is handed", () => {
    for (const junk of [null, undefined, "", 42, [], { nonsense: true }, { ActionError: null }]) {
      expect(() => decodeNearError(junk, null)).not.toThrow()
      expect(decodeNearError(junk, null).reason.length).toBeGreaterThan(0)
    }
  })
})

describe("failures that are not the contract rejecting anything", () => {
  /**
   * The runtime reuses ExecutionError for running out of gas, which is NOT a
   * contract refusing the call and needs the opposite advice: send it again
   * with more gas, rather than change what you asked for.
   */
  it("separates out of gas from a contract panic", () => {
    const d = decodeNearError({ ActionError: { index: 0, kind: { FunctionCallError: {
      ExecutionError: "Exceeded the prepaid gas." } } } }, "v2.ref-finance.near")
    expect(d.cause).toBe("out_of_gas")
    expect(d.reason).toMatch(/more gas/)
  })

  it("explains a reused nonce without telling anyone to just retry", () => {
    const d = decodeNearError({ InvalidTxError: { InvalidNonce: { tx_nonce: 1, ak_nonce: 2 } } }, null)
    expect(d.cause).toBe("invalid_transaction")
    // The dangerous advice here is "send it again": the first one may have
    // landed. Check first.
    expect(d.reason).toMatch(/Check whether the first one succeeded/)
  })

  it("says an expired transaction is safe to replace, because that is the fear", () => {
    const d = decodeNearError({ InvalidTxError: "Expired" }, null)
    expect(d.reason).toMatch(/safe to sign a new one/)
  })

  it("explains the storage-cost failure in NEAR's own terms", () => {
    const d = decodeNearError({ ActionError: { index: 0, kind: { LackBalanceForState: {} } } }, "a.near")
    expect(d.unrecognised).toBe(false)
    expect(d.reason).toMatch(/storage/)
  })
})

describe("the error map states its own provenance", () => {
  /**
   * Sui's DeepBook map was harvested mechanically from published source with a
   * drift test. Ref's contracts need a GitHub token, so this map is built from
   * failures OBSERVED LIVE. That is weaker provenance and the map must stay
   * small enough to remain defensible: every key here was seen returned.
   */
  it("only holds contracts we have real payloads for", () => {
    expect(MAPPED_CONTRACTS.sort()).toEqual(["intents.near", "v2.ref-finance.near"])
  })

  it("holds English for every code it lists", () => {
    for (const [contract, codes] of Object.entries(PROTOCOL_ERRORS)) {
      for (const [code, text] of Object.entries(codes)) {
        expect(text.length, `${contract} ${code}`).toBeGreaterThan(40)
        expect(text, `${contract} ${code}`).not.toMatch(/—/)
      }
    }
  })
})
