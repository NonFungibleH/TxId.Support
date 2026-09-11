import { describe, it, expect } from "vitest"
import { CHAIN_CONFIGS } from "@txid/blockchain"

/**
 * "Non-EVM" is defined in three places in this repo and they disagree.
 *
 *   apps/web/lib/chains.ts        family === "non-evm"     derived, correct
 *   apps/app/.../WidgetApp.tsx    a written array of six
 *   packages/ai/src/tools.ts      Solana OR Aptos          TWO of the six
 *
 * The last one filters the EVM candidate list for a transaction lookup, so
 * Sui, Stellar, NEAR and Hyperliquid were pushed into an EVM fan-out. They
 * have no CHAIN_CONFIGS entry, so each threw and was recorded as an
 * UNREACHABLE CHAIN, and that list is handed to the model. A Stellar project
 * looking up a hash got told Stellar could not be reached, when Stellar was
 * never something that fan-out could have asked.
 *
 * There is an exact derivation available here: a chain id usable for an EVM
 * lookup is one CHAIN_CONFIGS has an entry for. Anything else is not a chain
 * this fan-out can ask, whether it is Move-native or simply unknown.
 */
const NON_EVM_LIVE = ["solana", "aptos", "sui", "stellar", "near", "hyperliquid"]

describe("the EVM candidate filter", () => {
  it("rejects every non-EVM chain, not just the two it was written for", async () => {
    const { isNonEvmChainId } = await import("./tools")
    const leaked = NON_EVM_LIVE.filter(id => !isNonEvmChainId(id))
    expect(leaked, "these would be fanned out to an EVM lookup").toEqual([])
  })

  it("still accepts every EVM chain, so the filter cannot pass by rejecting everything", async () => {
    const { isNonEvmChainId } = await import("./tools")
    const evm = Object.keys(CHAIN_CONFIGS).filter(id => id.startsWith("0x"))
    expect(evm.length).toBeGreaterThan(8)
    expect(evm.filter(id => isNonEvmChainId(id))).toEqual([])
  })

  it("treats an id nothing knows as not-EVM, because the fan-out cannot ask it", () => {
    // Failing closed: an unknown id is not something to throw an EVM lookup at.
    return import("./tools").then(({ isNonEvmChainId }) => {
      expect(isNonEvmChainId("0xdeadbeef")).toBe(true)
      expect(isNonEvmChainId("definitely-not-a-chain")).toBe(true)
    })
  })
})
