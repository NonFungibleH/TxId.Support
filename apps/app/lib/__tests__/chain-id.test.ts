import { describe, it, expect } from "vitest"
import { canonicalChainId } from "@txid/blockchain"

/**
 * The bug this pins was found by driving the live demo as a user.
 *
 * On BNB Chain the assistant said: "You're on chain 56, but PancakeSwap's
 * contracts live on BNB Chain (0x38). Switch your wallet." 56 IS 0x38. It sent
 * a user who was on the correct network to go and fix nothing, in the most
 * confident language it has, on the single most common diagnosis path.
 *
 * Wallets return hex from eth_chainId; interfaces and humans use decimal. Any
 * comparison of the two as raw strings reintroduces this.
 */
describe("canonicalChainId", () => {
  it("treats decimal and hex spellings of one chain as the same chain", () => {
    expect(canonicalChainId("56")).toBe(canonicalChainId("0x38"))   // BNB Chain
    expect(canonicalChainId("1")).toBe(canonicalChainId("0x1"))     // Ethereum
    expect(canonicalChainId("8453")).toBe(canonicalChainId("0x2105")) // Base
    expect(canonicalChainId("137")).toBe(canonicalChainId("0x89"))  // Polygon
    expect(canonicalChainId("42161")).toBe(canonicalChainId("0xa4b1")) // Arbitrum
  })

  it("follows the wallet convention: 0x means hex, bare digits mean decimal", () => {
    // "38" is decimal 38, NOT 0x38. Reading it as hex would silently map
    // Ethereum-adjacent ids onto the wrong chain, which is worse than failing.
    expect(canonicalChainId("38")).toBe("0x26")
    expect(canonicalChainId("0x38")).toBe("0x38")
  })

  it("normalises case and leading zeros", () => {
    expect(canonicalChainId("0X38")).toBe("0x38")
    expect(canonicalChainId("0x038")).toBe("0x38")
    expect(canonicalChainId(" 0x38 ")).toBe("0x38")
  })

  it("leaves non-EVM chains alone", () => {
    expect(canonicalChainId("solana")).toBe("solana")
    expect(canonicalChainId("aptos")).toBe("aptos")
    expect(canonicalChainId("Aptos")).toBe("aptos")
  })

  it("does not invent a value for nonsense", () => {
    expect(canonicalChainId("")).toBe("")
    expect(canonicalChainId("not-a-chain")).toBe("not-a-chain")
  })
})
