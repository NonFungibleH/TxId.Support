import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { LookupUnavailableError } from "./errors"
import { ETHERSCAN_CHAIN_IDS } from "./blockscout"
import { CHAIN_CONFIGS, nativeSymbol } from "./types"
import { getNativeBalance, getTokenBalances } from "./wallet"

/**
 * A native balance is `eth_getBalance`, and every EVM node answers it.
 *
 * It used to throw "No indexer configured" on any chain without Moralis or
 * Blockscout, which was wrong twice over. Wrong as engineering, because the one
 * balance needing no index is the native one: token holdings must be
 * enumerated and history must be indexed, but this is a single call. And wrong
 * as a CLAIM, because Robinhood Chain's own comment said "native balance, nonce
 * and gas all run on the RPC and work normally" while this function threw for
 * it. Verified against live Robinhood Chain: the RPC answered immediately and
 * getNativeBalance threw. A claim in a comment is not a test, which is why this
 * file exists.
 */
const ADDR = "0x" + "a".repeat(40)
const RPC_ONLY = "0x3e7"   // HyperEVM: no Moralis, no Blockscout
const MORALIS_CHAIN = "0x1" // Ethereum

const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: new Headers() }) as unknown as Response

beforeEach(() => vi.stubEnv("MORALIS_API_KEY", "test-key"))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("a native balance on a chain with no indexer", () => {
  it("reads it from the chain's own RPC", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ jsonrpc: "2.0", id: 1, result: "0x" + (2n * 10n ** 18n).toString(16) })))
    const b = await getNativeBalance(ADDR, RPC_ONLY)
    expect(b.balance).toBe("2000000000000000000")
    expect(b.balanceFormatted).toBe("2")
    expect(b.symbol).toBe("HYPE")
  })

  // A JSON-RPC error object is a node DECLINING to answer. Reporting it as a
  // balance would tell somebody their wallet is empty during an outage, which
  // is the exact class of bug the September audit was about.
  it("a node that declines is unavailable, never a balance of zero", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ jsonrpc: "2.0", id: 1, error: { message: "rate limited" } })))
    await expect(getNativeBalance(ADDR, RPC_ONLY)).rejects.toBeInstanceOf(LookupUnavailableError)
  })

  it("an unreachable node is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up") }))
    await expect(getNativeBalance(ADDR, RPC_ONLY)).rejects.toBeInstanceOf(LookupUnavailableError)
  })

  // Token balances and history genuinely need an index, so they must keep
  // refusing rather than reporting an empty wallet. The fix is scoped to the
  // one read that does not need one.
  it("does not pretend token balances are available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ jsonrpc: "2.0", id: 1, result: "0x0" })))
    await expect(getTokenBalances(ADDR, RPC_ONLY)).rejects.toThrow(/No indexer configured/)
  })
})

describe("the indexer stays preferred where there is one", () => {
  it("uses Moralis when it answers", async () => {
    const f = vi.fn(async (url: string) => {
      if (String(url).includes("moralis")) return json({ balance: "5000000000000000000" })
      throw new Error("the RPC should not have been called")
    })
    vi.stubGlobal("fetch", f)
    const b = await getNativeBalance(ADDR, MORALIS_CHAIN)
    expect(b.balanceFormatted).toBe("5")
    expect(b.symbol).toBe("ETH")
  })

  // The RPC is the backstop for every indexer failure, which is what #68
  // established. A Moralis outage must not become "your wallet is empty".
  it("falls through to the RPC when Moralis fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) =>
      String(url).includes("moralis")
        ? json({}, 503)
        : json({ jsonrpc: "2.0", id: 1, result: "0x" + (3n * 10n ** 18n).toString(16) }),
    ))
    const b = await getNativeBalance(ADDR, MORALIS_CHAIN)
    expect(b.balanceFormatted).toBe("3")
  })
})

describe("HyperEVM is registered everywhere adding a chain requires", () => {
  it("is an RPC-only chain, by design", () => {
    const c = CHAIN_CONFIGS[RPC_ONLY]
    expect(c?.name).toBe("HyperEVM")
    expect(c?.rpcUrl).toMatch(/^https:\/\//)
    // Moralis does not list 999, and there is no reachable Blockscout. If
    // either ever changes, this is the line that says so out loud.
    expect(c?.moralisChain).toBeUndefined()
    expect(c?.blockscoutApi).toBeUndefined()
  })

  // chainid.network still lists 999 as a legacy "Wanchain Testnet". Etherscan
  // V2's own chainlist reports HyperEVM Mainnet, and the RPC returns 0x3e7.
  it("says HYPE, and never falls back to ETH", () => {
    expect(nativeSymbol(RPC_ONLY)).toBe("HYPE")
    expect(nativeSymbol(RPC_ONLY)).not.toBe("ETH")
  })

  it("is registered for Etherscan V2, so ABIs need no new credential", () => {
    expect(ETHERSCAN_CHAIN_IDS[RPC_ONLY]).toBe(999)
  })
})
