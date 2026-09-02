import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { getTransactionByHash } from "./wallet"
import { CHAIN_CONFIGS } from "./types"

/**
 * The same chain, spelled two ways, must be the same chain.
 *
 * A chain id arrives as hex from a wallet ("0x38") and as a NUMBER from wagmi
 * or viem, which `window.txid.identify` stringifies to "56". Every lookup in
 * this package is a raw `CHAIN_CONFIGS[chainId]`, so the decimal form missed
 * and Moralis was asked for a BNB Chain transaction on ETHEREUM, where it
 * truthfully does not exist. The user was told their swap never happened.
 *
 * These pin the shape of that bug rather than one instance of it: the failure
 * is silent, both spellings return the same type, and only the chain queried
 * differs.
 */
const HASH = "0x484cf93b31ffe7c01bfa04a241dd0e0f62309768e538c6dbbd17f5368a863538"

const BNB_HEX = "0x38"
const BNB_DECIMAL = "56"

beforeEach(() => vi.stubEnv("MORALIS_API_KEY", "test-key"))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

/** Records every URL asked for, and answers nothing. */
function recordingFetch() {
  const urls: string[] = []
  const fn = vi.fn(async (url: string | URL) => {
    urls.push(String(url))
    return { ok: false, status: 404 } as Response
  })
  return { fn, urls }
}

describe("chain id spelling", () => {
  it("resolves BNB Chain by hex and by decimal to the same config", () => {
    expect(CHAIN_CONFIGS[BNB_DECIMAL], "wagmi sends 56, not 0x38").toBeDefined()
    expect(CHAIN_CONFIGS[BNB_DECIMAL]).toBe(CHAIN_CONFIGS[BNB_HEX])
  })

  it("keeps one canonical id on the config itself", () => {
    // Anything reading cfg.id back must see hex, whichever key found it.
    expect(CHAIN_CONFIGS[BNB_DECIMAL]!.id).toBe(BNB_HEX)
  })

  it("covers every chain, not just BNB", () => {
    for (const [id, cfg] of Object.entries(CHAIN_CONFIGS)) {
      if (!id.startsWith("0x")) continue
      const decimal = String(Number.parseInt(id, 16))
      expect(CHAIN_CONFIGS[decimal], `${cfg.name} is unreachable by decimal id`).toBe(cfg)
    }
  })

  it("never asks Ethereum about a BNB Chain transaction", async () => {
    const { fn, urls } = recordingFetch()
    vi.stubGlobal("fetch", fn)
    await getTransactionByHash(HASH, BNB_DECIMAL)

    const moralis = urls.filter(u => u.includes("moralis"))
    expect(moralis.length, "the indexer should have been asked").toBeGreaterThan(0)
    for (const u of moralis) {
      expect(u, "a decimal chain id must not silently become Ethereum").toContain("chain=bsc")
      expect(u).not.toContain("chain=eth")
    }
  })

  it("uses the BNB Chain RPC for the fallback, not none at all", async () => {
    const { fn, urls } = recordingFetch()
    vi.stubGlobal("fetch", fn)
    await getTransactionByHash(HASH, BNB_DECIMAL)

    // The fallback reads rpcUrl from the same lookup. A missed key made it
    // return null, so the indexer fix did not save a decimal chain id either.
    const rpc = CHAIN_CONFIGS[BNB_HEX]!.rpcUrl
    expect(urls.some(u => u.startsWith(rpc)), "the RPC fallback never ran").toBe(true)
  })

  it("asks the same questions for both spellings", async () => {
    const hex = recordingFetch()
    vi.stubGlobal("fetch", hex.fn)
    await getTransactionByHash(HASH, BNB_HEX)

    const dec = recordingFetch()
    vi.stubGlobal("fetch", dec.fn)
    await getTransactionByHash(HASH, BNB_DECIMAL)

    expect(dec.urls).toEqual(hex.urls)
  })
})
