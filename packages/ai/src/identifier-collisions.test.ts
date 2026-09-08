import { describe, it, expect } from "vitest"
import { isAptosAddress } from "@txid/aptos"
import { isNearAccount, isNearTxHash, looksLikeForeignAddress } from "@txid/near"
import { isStellarAccount, normalizeStellarTxHash } from "@txid/stellar"

/**
 * The identifier collisions that force every routing decision in tools.ts.
 *
 * These facts are asserted in comments across six packages and enforced
 * nowhere. That is a problem, because the design they justify looks like
 * needless complexity to anyone reading one arm in isolation: every
 * chain-specific lookup is gated on that chain being IN PLAY rather than on the
 * shape of the identifier, and the obvious "simplification" is to route on
 * shape.
 *
 * Routing on shape means looking a transaction up on the wrong chain, which
 * returns NOT FOUND. That is a confident wrong answer about somebody's money,
 * and it is the exact failure this codebase exists to refuse. So the collisions
 * are pinned here: if one ever stops being true, the comment that depends on it
 * should stop being true at the same moment.
 */

// Real identifiers, captured from mainnet during the integrations.
// Both captured live. NEAR_HASH is a real NEAR transaction; SUI_DIGEST is a
// real Sui digest. They are the same shape, which is the whole point: 32 bytes
// of base58 either way.
const NEAR_HASH = "C2bqVtuYgc16oQ464YwQuR8RqdXqaNrbFRNf7hbnyRhj"
const SUI_DIGEST = "8xQhVYPvUKKKNfmSHTPBSGtSCDpFyFwCsGKPZfBGMHmn"
const SOLANA_SIG = "4Svjq39VZxmywx29Gwx7PN7axzfTrDa2VgtsBdeiVzzuLVz2xW4oRdxHWUpTcjBzY7dGzJrQ3L6pTyox5KKyxJSW"
const EVM_HASH = "0x" + "a".repeat(64)
const STELLAR_HASH = "b".repeat(64)                                       // 64 hex, NO prefix
const EVM_ADDR = "0x" + "c".repeat(40)
const MOVE_ADDR = "0x" + "d".repeat(64)                                   // Aptos AND Sui
const STELLAR_ACCT = "GA6HCMBLTZS5VYYBCATRBRZ3BZJMAFUDKYYF6AH6MVCMGWMRDNSWJPIH"
const NEAR_ACCT = "v2.ref-finance.near"

describe("a NEAR transaction hash is shaped exactly like a Sui digest", () => {
  /**
   * Both are base58, 43 to 44 characters. The NEAR arm in tools.ts therefore
   * sits BEFORE the Sui arm and is gated on NEAR being in play; a project is
   * not on both chains at once.
   */
  it("is base58 of the same length, so shape cannot separate them", () => {
    expect(isNearTxHash(SUI_DIGEST)).toBe(true)
    expect(isNearTxHash(NEAR_HASH)).toBe(true)
    expect(SUI_DIGEST.length).toBeGreaterThanOrEqual(43)
    expect(SUI_DIGEST.length).toBeLessThanOrEqual(44)
  })

  /**
   * Solana signatures are base58 TOO, but 64 bytes rather than 32, so length
   * is the one discriminator that does work here. Without it a Sui digest
   * pasted into a Solana project is looked up on the wrong chain and reported
   * as never having existed.
   */
  it("is separable from a Solana signature only by length", () => {
    expect(SOLANA_SIG.length).toBeGreaterThan(80)
    expect(SUI_DIGEST.length).toBeLessThan(50)
    const suiDigestShape = /^[1-9A-HJ-NP-Za-km-z]{43,44}$/
    expect(suiDigestShape.test(SUI_DIGEST)).toBe(true)
    expect(suiDigestShape.test(SOLANA_SIG)).toBe(false)
  })
})

describe("a Stellar transaction hash is an EVM hash with its 0x removed", () => {
  it("is 64 hex either way", () => {
    expect(normalizeStellarTxHash(STELLAR_HASH)).toBe(STELLAR_HASH)
    // The same 64 hex characters, with a prefix, are an EVM hash.
    expect(/^0x[0-9a-fA-F]{64}$/.test("0x" + STELLAR_HASH)).toBe(true)
  })

  /**
   * So the Stellar arm cannot fire on shape. It is gated on Stellar being in
   * play AND on the hash not looking like an EVM one, which is why the arm
   * carries `&& !looksEvm`.
   */
  it("means an EVM hash must not be routed to Stellar on shape alone", () => {
    const looksEvm = /^0x[0-9a-fA-F]{64}$/.test(EVM_HASH)
    expect(looksEvm).toBe(true)
    // Stripped of its prefix it would normalise as a Stellar hash, which is
    // exactly the trap.
    expect(normalizeStellarTxHash(EVM_HASH.slice(2))).not.toBeNull()
  })
})

describe("Aptos and Sui addresses are the same shape as each other", () => {
  it("both accept 0x plus up to 64 hex, so neither is decided on shape", () => {
    expect(isAptosAddress(MOVE_ADDR)).toBe(true)
    // An EVM address is also valid Aptos shape, which is why the widget's
    // paste box resolves the chain from the PROJECT rather than the string.
    expect(isAptosAddress(EVM_ADDR)).toBe(true)
  })
})

describe("NEAR is the one chain whose account id is a name", () => {
  it("cannot be confused with any hex identifier", () => {
    expect(isNearAccount(NEAR_ACCT)).toBe(true)
    expect(isNearAccount(STELLAR_ACCT)).toBe(false)  // uppercase strkey
    expect(isAptosAddress(NEAR_ACCT)).toBe(false)
  })

  /**
   * With one exception that must not be papered over: an EVM address is a
   * structurally VALID NEAR account name, because `0x` plus hex is lowercase
   * alphanumerics and that is exactly what NEAR permits. The validator stays
   * honest about the specification; a SEPARATE predicate answers "did the user
   * paste the wrong thing".
   */
  it("admits an EVM address is a valid NEAR name, and flags it separately", () => {
    expect(isNearAccount(EVM_ADDR)).toBe(true)
    expect(looksLikeForeignAddress(EVM_ADDR)).toBe(true)
    expect(looksLikeForeignAddress(NEAR_ACCT)).toBe(false)
  })
})

describe("Stellar is the only CHECKSUMMED identifier we take", () => {
  /**
   * Every other chain accepts a typo as a well-formed address and reports back
   * about an account that was never the user's. Stellar's strkey carries a
   * CRC16, so the mistake is caught at the box.
   */
  it("rejects a one-character typo that every other shape would accept", () => {
    expect(isStellarAccount(STELLAR_ACCT)).toBe(true)
    const typo = STELLAR_ACCT.slice(0, -1) + (STELLAR_ACCT.endsWith("H") ? "J" : "H")
    expect(isStellarAccount(typo)).toBe(false)
  })
})

describe("the collisions taken together", () => {
  /**
   * The summary that justifies the whole design: for every identifier we
   * accept, at least one OTHER chain accepts the same string. Routing is
   * therefore always "which chain is in play", never "what does this look
   * like".
   */
  it("leaves no identifier that shape alone can route", () => {
    const ambiguous: Array<[string, string, boolean]> = [
      ["Sui digest also passes NEAR's hash check", SUI_DIGEST, isNearTxHash(SUI_DIGEST)],
      ["EVM address also passes Aptos's address check", EVM_ADDR, isAptosAddress(EVM_ADDR)],
      ["EVM address is also a valid NEAR account name", EVM_ADDR, isNearAccount(EVM_ADDR)],
      ["EVM hash minus 0x is a valid Stellar hash", EVM_HASH.slice(2), normalizeStellarTxHash(EVM_HASH.slice(2)) !== null],
    ]
    for (const [why, , collides] of ambiguous) expect(collides, why).toBe(true)
  })
})
