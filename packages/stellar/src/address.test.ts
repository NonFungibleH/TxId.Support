import { describe, it, expect } from "vitest"
import { isStellarAccount, isStellarContract, normalizeStellarTxHash, strkeyKind } from "./address"

/**
 * A typo in a 56-character address still looks like an address. Without the
 * checksum we would accept one and then tell somebody their account does not
 * exist, when what we actually did was ask about an account that was never
 * theirs. That is an absence produced by our own error, which is the failure
 * mode this codebase exists to refuse.
 */
// BOTH CAPTURED FROM LIVE MAINNET on 2026-09-08, not invented. The first draft
// of this file used a hand-made account address; it failed the checksum, which
// is the test doing precisely its job on its own author.
const ACCOUNT = "GCY7CS6PUPRVVSJO7UWV6DOHXXDGTGIHIE6F3VCBPNDXZFCOK57Y2DNG"
const CONTRACT = "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA"

describe("strkeys are validated, not pattern-matched", () => {
  it("accepts a real account and a real contract", () => {
    expect(strkeyKind(ACCOUNT)).toBe("account")
    expect(strkeyKind(CONTRACT)).toBe("contract")
    expect(isStellarAccount(ACCOUNT)).toBe(true)
    expect(isStellarContract(CONTRACT)).toBe(true)
  })

  it("does not confuse the two kinds", () => {
    expect(isStellarAccount(CONTRACT)).toBe(false)
    expect(isStellarContract(ACCOUNT)).toBe(false)
  })

  // The whole reason the CRC is here. One character changed leaves something
  // that still looks exactly like a Stellar address.
  it("rejects a single-character typo", () => {
    const typo = ACCOUNT.slice(0, 10) + (ACCOUNT[10] === "A" ? "B" : "A") + ACCOUNT.slice(11)
    expect(typo).toHaveLength(ACCOUNT.length)
    expect(strkeyKind(typo)).toBeNull()
  })

  it("rejects the obvious non-addresses", () => {
    for (const junk of ["", "G", "0x" + "a".repeat(40), ACCOUNT.slice(0, 55), ACCOUNT + "A", "not an address"]) {
      expect(strkeyKind(junk), junk).toBeNull()
    }
  })

  it("accepts lower case, because people paste from anywhere", () => {
    expect(strkeyKind(ACCOUNT.toLowerCase())).toBe("account")
  })
})

describe("transaction hashes", () => {
  const H = "a".repeat(64)

  it("takes 64 hex, with or without an 0x somebody added", () => {
    expect(normalizeStellarTxHash(H)).toBe(H)
    expect(normalizeStellarTxHash(`0x${H}`)).toBe(H)
    expect(normalizeStellarTxHash(H.toUpperCase())).toBe(H)
    expect(normalizeStellarTxHash(`  ${H}  `)).toBe(H)
  })

  it("rejects anything else", () => {
    for (const junk of ["", "a".repeat(63), "a".repeat(65), "z".repeat(64), ACCOUNT]) {
      expect(normalizeStellarTxHash(junk), junk).toBeNull()
    }
  })
})
