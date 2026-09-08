import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { ETHERSCAN_CHAIN_IDS } from "./blockscout"
import { CHAIN_CONFIGS, nativeSymbol } from "./types"
import { getNativeBalance, getTokenBalances } from "./wallet"

/**
 * Three chains added 2026-09-08, each on a different wallet route, which is the
 * thing to get right: picking the wrong one shows up as an empty transaction
 * list rather than an error.
 *
 * Coverage was established live before shipping, not read from documentation.
 * Moralis indexes none of the three (checked against Moralis's own OpenAPI
 * chain list, which correctly reports Monad indexed and HyperEVM not, so the
 * method is sound). Unichain has a complete Blockscout v2; Plasma and Mantle
 * have none and take the RPC-only route.
 */
const UNICHAIN = "0x82"    // 130
const PLASMA   = "0x2611"  // 9745
const MANTLE   = "0x1388"  // 5000

const json = (b: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => b, headers: new Headers() }) as unknown as Response

beforeEach(() => vi.stubEnv("MORALIS_API_KEY", "test-key"))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("each chain takes the route its coverage actually supports", () => {
  it("Unichain has a Blockscout, so it gets the full wallet path", () => {
    const c = CHAIN_CONFIGS[UNICHAIN]
    expect(c?.name).toBe("Unichain")
    expect(c?.blockscoutApi).toBe("https://unichain.blockscout.com/api")
    // Verified live: token-balances returned 20 holdings, transactions 50 items.
    expect(c?.moralisChain).toBeUndefined()
  })

  /**
   * plasmascan.to answers /api/v2/... with HTML, and its own /api replies
   * "use api.plasmascan.to", which is Etherscan-family and V2-only. There is no
   * Blockscout. An earlier scoping pass recorded one because the probe checked
   * the status code and not the body, which is the same mistake as reading a
   * 200 with an error payload as a success.
   */
  it("Plasma and Mantle have neither indexer, so they are RPC-only", () => {
    for (const id of [PLASMA, MANTLE]) {
      const c = CHAIN_CONFIGS[id]
      expect(c?.moralisChain, `${c?.name} moralis`).toBeUndefined()
      expect(c?.blockscoutApi, `${c?.name} blockscout`).toBeUndefined()
      expect(c?.rpcUrl, `${c?.name} rpc`).toMatch(/^https:\/\//)
    }
  })

  it("a native balance still works on the RPC-only chains", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      json({ jsonrpc: "2.0", id: 1, result: "0x" + (4n * 10n ** 18n).toString(16) })))
    for (const [id, sym] of [[PLASMA, "XPL"], [MANTLE, "MNT"]] as const) {
      const b = await getNativeBalance("0x" + "a".repeat(40), id)
      expect(b.balanceFormatted).toBe("4")
      expect(b.symbol).toBe(sym)
    }
  })

  // Token holdings must be enumerated, which needs an index. Reporting an empty
  // wallet instead would be the bug the September audits were about.
  it("token balances refuse rather than report an empty wallet", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ jsonrpc: "2.0", id: 1, result: "0x0" })))
    for (const id of [PLASMA, MANTLE]) {
      await expect(getTokenBalances("0x" + "a".repeat(40), id)).rejects.toThrow(/No indexer configured/)
    }
  })
})

describe("the gas token is the chain's own", () => {
  /**
   * Mantle is an L2 whose gas token is MNT, and Plasma's is XPL. Before the
   * September audit removed every `?? "ETH"`, both would have told a user to
   * top up ETH on a chain that has none. Unichain genuinely is ETH.
   */
  it("names MNT and XPL, never ETH", () => {
    expect(nativeSymbol(MANTLE)).toBe("MNT")
    expect(nativeSymbol(MANTLE)).not.toBe("ETH")
    expect(nativeSymbol(PLASMA)).toBe("XPL")
    expect(nativeSymbol(PLASMA)).not.toBe("ETH")
    expect(nativeSymbol(UNICHAIN)).toBe("ETH")
  })
})

describe("Etherscan V2 covers all three, so ABIs need no new credential", () => {
  // Confirmed against https://api.etherscan.io/v2/chainlist: all three report
  // status 1. One ETHERSCAN_API_KEY covers every chain it lists.
  it("registers the numeric ids", () => {
    expect(ETHERSCAN_CHAIN_IDS[UNICHAIN]).toBe(130)
    expect(ETHERSCAN_CHAIN_IDS[PLASMA]).toBe(9745)
    expect(ETHERSCAN_CHAIN_IDS[MANTLE]).toBe(5000)
  })
})
