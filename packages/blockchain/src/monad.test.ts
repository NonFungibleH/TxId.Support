import { describe, it, expect } from "vitest"
import { ETHERSCAN_CHAIN_IDS } from "./blockscout"
import { CHAIN_CONFIGS, nativeSymbol } from "./types"

/**
 * Adding a chain is a checklist, and the parts that go wrong are the ones no
 * single file makes obvious. These pin the three that would each produce a
 * confidently wrong answer rather than a visible error.
 *
 * Verified against live Monad on 2026-09-08 before this was written: a real
 * failed transaction resolved through `diagnoseTransaction` to
 * `out_of_gas`, chain "Monad", with the gas-limit fix, and it did so with no
 * Moralis key present, so the RPC path stands on its own.
 */
describe("Monad is registered everywhere adding a chain requires", () => {
  const MONAD = "0x8f"

  it("is in CHAIN_CONFIGS with the right identity", () => {
    const c = CHAIN_CONFIGS[MONAD]
    expect(c).toBeTruthy()
    expect(c?.name).toBe("Monad")
    expect(c?.id).toBe(MONAD)
    expect(c?.explorer).toContain("monadscan.com")
  })

  // THE ONE THAT WOULD BE SILENT. Before the September audit every unknown
  // chain fell back to `?? "ETH"`, so a Monad user short of MON would have been
  // told to top up their ETH, on a chain that has none.
  it("says MON, and never falls back to ETH", () => {
    expect(nativeSymbol(MONAD)).toBe("MON")
    expect(nativeSymbol(MONAD)).not.toBe("ETH")
  })

  // Moralis's own supported-chains table lists 0x8f, so this is an ordinary
  // Moralis chain. If that ever stops being true the symptom is an empty
  // transaction list rather than an error, so the assertion is explicit.
  it("routes wallet reads through Moralis, not a fallback path", () => {
    expect(CHAIN_CONFIGS[MONAD]?.moralisChain).toBe("0x8f")
    expect(CHAIN_CONFIGS[MONAD]?.blockscoutApi).toBeUndefined()
  })

  // Etherscan V2 is one key across every chain it covers, so ABI fetching,
  // contract verification and the error glossary need no new credential. The
  // numeric id has to be registered or explorerQuery silently skips to the
  // Blockscout fallback, which does not exist for this chain.
  it("is registered for Etherscan V2 by its numeric id", () => {
    expect(ETHERSCAN_CHAIN_IDS[MONAD]).toBe(143)
  })

  it("has an RPC, which is the backstop for every indexer failure", () => {
    expect(CHAIN_CONFIGS[MONAD]?.rpcUrl).toMatch(/^https:\/\//)
  })
})
