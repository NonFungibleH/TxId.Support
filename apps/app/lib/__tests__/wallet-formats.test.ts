import { describe, it, expect } from "vitest"
import { isStellarAccount } from "@txid/stellar"

/**
 * The widget and the chat route must agree on which addresses are valid.
 *
 * They disagreed once already and the failure mode is nasty: the widget accepts
 * an address, hides the connect UI because it believes a wallet is attached,
 * and then EVERY message 400s at the route with no way for the user to get
 * back. The comment on WidgetApp's checker used to say "keep in sync with the
 * route", and a comment is not a mechanism. For Stellar, the mechanism is that
 * both import the same function, and this file pins the rest.
 *
 * Kept deliberately as data rather than by importing the widget's own checker,
 * which lives in a "use client" component: what matters is that the RULES agree,
 * not that the code is shared.
 */

// Mirrors WidgetApp.tsx and app/api/chat/route.ts.
const EVM = /^0x[0-9a-fA-F]{40}$/
const SOL = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const APTOS = /^0x[0-9a-fA-F]{1,64}$/
const SUI = /^0x[0-9a-fA-F]{1,64}$/

function accepted(addr: string, chainId?: string | null): boolean {
  return (
    EVM.test(addr) ||
    SOL.test(addr) ||
    (chainId === "aptos" && APTOS.test(addr)) ||
    (chainId === "sui" && SUI.test(addr)) ||
    (chainId === "stellar" && isStellarAccount(addr))
  )
}

// Real mainnet values.
const EVM_ADDR = "0x" + "a".repeat(40)
const APTOS_ADDR = "0x" + "1".repeat(64)
const STELLAR_ADDR = "GCY7CS6PUPRVVSJO7UWV6DOHXXDGTGIHIE6F3VCBPNDXZFCOK57Y2DNG"

describe("which wallet addresses the widget and the route both accept", () => {
  it("takes an EVM address on any chain", () => {
    expect(accepted(EVM_ADDR)).toBe(true)
    expect(accepted(EVM_ADDR, "sui")).toBe(true)
    expect(accepted(EVM_ADDR, "stellar")).toBe(true)
  })

  // HyperCore is an exchange rather than a chain, but it shares HyperEVM's
  // address space, so a plain EVM address IS the Hyperliquid identity. The rule
  // needs no special case, and this pins that it stays true.
  it("takes a plain EVM address on Hyperliquid", () => {
    expect(accepted(EVM_ADDR, "hyperliquid")).toBe(true)
    expect(accepted(APTOS_ADDR, "hyperliquid")).toBe(false)
    expect(accepted(STELLAR_ADDR, "hyperliquid")).toBe(false)
  })

  // Sui and Aptos addresses are the SAME SHAPE, so neither is accepted on the
  // strength of the shape alone: the request has to say which chain it is.
  it("takes a 64-hex address only when the chain says Move", () => {
    expect(accepted(APTOS_ADDR, "aptos")).toBe(true)
    expect(accepted(APTOS_ADDR, "sui")).toBe(true)
    expect(accepted(APTOS_ADDR)).toBe(false)
    expect(accepted(APTOS_ADDR, "0x1")).toBe(false)
    expect(accepted(APTOS_ADDR, "stellar")).toBe(false)
  })

  it("takes a Stellar account only on Stellar, and only when it checksums", () => {
    expect(accepted(STELLAR_ADDR, "stellar")).toBe(true)
    expect(accepted(STELLAR_ADDR, "sui")).toBe(false)
    expect(accepted(STELLAR_ADDR)).toBe(false)
  })

  // The reason Stellar is validated rather than pattern-matched. A one
  // character typo still looks exactly like an address, and accepting it means
  // answering confidently about an account that was never the user's.
  it("rejects a one-character typo in a Stellar address", () => {
    const typo = STELLAR_ADDR.slice(0, 10) + (STELLAR_ADDR[10] === "A" ? "B" : "A") + STELLAR_ADDR.slice(11)
    expect(typo).toHaveLength(STELLAR_ADDR.length)
    expect(accepted(typo, "stellar")).toBe(false)
  })

  it("rejects junk on every chain", () => {
    for (const junk of ["", "0x", "not an address", "0x" + "z".repeat(40), "G" + "1".repeat(55)]) {
      for (const chain of [undefined, "0x1", "aptos", "sui", "stellar", "solana"]) {
        expect(accepted(junk, chain), `${junk} on ${chain}`).toBe(false)
      }
    }
  })
})
