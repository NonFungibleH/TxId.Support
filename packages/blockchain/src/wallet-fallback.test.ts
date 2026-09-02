import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { getTransactionByHash } from "./wallet"

/**
 * A provider that cannot answer is not a chain that has nothing.
 *
 * Three successful PancakeSwap swaps, over an hour old and plainly on BNB
 * Chain, were reported to a user as "not found on BNB Chain, most likely
 * rejected in your wallet, no gas was spent". The indexer had failed and the
 * code returned null, which every caller above reads as "no such transaction".
 *
 * These pin the fallback, because the failure is invisible from the outside:
 * both cases return a value of the same type, and only the source differs.
 */
const HASH = "0x484cf93b31ffe7c01bfa04a241dd0e0f62309768e538c6dbbd17f5368a863538"
const ROUTER = "0x10ed43c718714eb63d5aa57b78b54704e256024e"

const rpcReply = (result: unknown) => ({ ok: true, json: async () => ({ result }) } as unknown as Response)

/** Indexer fails; the RPC has the transaction. */
function providerDown() {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("moralis")) return { ok: false, status: 429 } as Response
    const body = JSON.parse(String(init?.body ?? "{}")) as { method: string }
    if (body.method === "eth_getTransactionByHash") {
      return rpcReply({
        hash: HASH, blockNumber: "0x71fd21c", from: "0xabc", to: ROUTER,
        value: "0x0", gas: "0x30d40", input: "0x38ed1739",
      })
    }
    if (body.method === "eth_getTransactionReceipt") return rpcReply({ gasUsed: "0x9c40", status: "0x1" })
    if (body.method === "eth_getBlockByNumber") return rpcReply({ timestamp: "0x66d0a000" })
    return rpcReply(null)
  })
}

// moralisHeaders() THROWS when the key is unset, which is itself a route to
// the same bug: before the fallback existed, a missing key propagated out and
// every caller read it as "no such transaction". Stubbed here so the indexer
// branch is actually exercised.
beforeEach(() => vi.stubEnv("MORALIS_API_KEY", "test-key"))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("a failing indexer does not become a missing transaction", () => {
  it("falls back to the chain's own RPC and finds it", async () => {
    vi.stubGlobal("fetch", providerDown())
    const tx = await getTransactionByHash(HASH, "0x38")
    expect(tx, "an indexer outage must not read as 'no such transaction'").not.toBeNull()
    expect(tx!.hash).toBe(HASH)
    expect(tx!.status).toBe("success")
  })

  it("reports success, not failure, when the receipt says 0x1", async () => {
    vi.stubGlobal("fetch", providerDown())
    const tx = await getTransactionByHash(HASH, "0x38")
    // The original bug told a user nothing happened. Reporting a successful
    // swap as failed would be the same error wearing a different hat.
    expect(tx!.status).not.toBe("failed")
  })

  it("still returns null when the CHAIN itself has never seen the hash", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) =>
      String(url).includes("moralis") ? ({ ok: false, status: 429 } as Response) : rpcReply(null)))
    // This is the one case where "not found" is a fact rather than a failure.
    await expect(getTransactionByHash(HASH, "0x38")).resolves.toBeNull()
  })

  it("survives the indexer key being unset, which used to throw", async () => {
    vi.unstubAllEnvs()
    vi.stubGlobal("fetch", providerDown())
    const tx = await getTransactionByHash(HASH, "0x38")
    expect(tx, "a missing MORALIS_API_KEY must not read as 'no such transaction'").not.toBeNull()
  })

  it("does not fall back when the indexer answered perfectly well", async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      if (String(url).includes("moralis")) {
        return { ok: true, json: async () => ({
          hash: HASH, block_number: "119542812", block_timestamp: "2026-09-01T10:00:00Z",
          from_address: "0xabc", to_address: ROUTER, value: "0", gas: "200000",
          input: "0x38ed1739", receipt_gas_used: "40000", receipt_status: "1",
        }) } as unknown as Response
      }
      throw new Error("must not reach the RPC when the indexer succeeded")
    })
    vi.stubGlobal("fetch", fetchMock)
    const tx = await getTransactionByHash(HASH, "0x38")
    expect(tx!.blockNumber).toBe("119542812")
  })
})
