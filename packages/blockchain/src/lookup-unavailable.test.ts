import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { getTransactionByHash, LookupUnavailableError } from "./wallet"
import { diagnoseTransaction } from "./diagnose"

/**
 * Two providers that cannot be asked are not a chain that has nothing.
 *
 * #68 added an RPC fallback so an indexer outage stopped reading as "your
 * transaction never happened". The fallback's own helper then returned null
 * for a network failure, exactly as it did for a node replying null, so an
 * indexer outage PLUS an RPC outage still produced "not found". Both free
 * public endpoints; both fail routinely.
 *
 * The lookup now throws LookupUnavailableError when nobody could be asked.
 * The fan-outs catch it and report the chain as unreachable rather than as
 * checked, and the API resolves to lookup_failed rather than not found.
 */
const HASH = "0x484cf93b31ffe7c01bfa04a241dd0e0f62309768e538c6dbbd17f5368a863538"
const BNB = "0x38"

const rpcReply = (result: unknown) =>
  ({ ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: 1, result }) }) as unknown as Response
const MINED = { hash: HASH, blockNumber: "0x71fd21c", from: "0xabc", to: "0xdef", value: "0x0", gas: "0x30d40", input: "0x" }

beforeEach(() => vi.stubEnv("MORALIS_API_KEY", "test-key"))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

/** Indexer down; the RPC behaves as `rpc` says. */
function providers(rpc: "answers-null" | "answers-tx" | "unreachable" | "json-error") {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("moralis")) return { ok: false, status: 503 } as Response
    const { method } = JSON.parse(String(init?.body ?? "{}")) as { method: string }
    if (rpc === "unreachable") throw new Error("ECONNRESET")
    if (rpc === "json-error") return rpcReply(undefined) // no result: handled below
    if (method === "eth_getTransactionByHash") return rpcReply(rpc === "answers-tx" ? MINED : null)
    if (method === "eth_getTransactionReceipt") return rpcReply({ gasUsed: "0x9c40", status: "0x1" })
    if (method === "eth_getBlockByNumber") return rpcReply({ timestamp: "0x66d0a000" })
    return rpcReply(null)
  })
}

describe("getTransactionByHash tells 'nobody answered' from 'no such transaction'", () => {
  it("throws LookupUnavailableError when the indexer is down AND the RPC is unreachable", async () => {
    vi.stubGlobal("fetch", providers("unreachable"))
    await expect(getTransactionByHash(HASH, BNB)).rejects.toBeInstanceOf(LookupUnavailableError)
  })

  it("throws when the RPC replies with a JSON-RPC error instead of a result", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      if (String(url).includes("moralis")) return { ok: false, status: 503 } as Response
      return { ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: 1, error: { code: -32005, message: "rate limited" } }) } as unknown as Response
    }))
    await expect(getTransactionByHash(HASH, BNB)).rejects.toBeInstanceOf(LookupUnavailableError)
  })

  it("still returns null when the RPC ANSWERS null, because that is a real answer", async () => {
    vi.stubGlobal("fetch", providers("answers-null"))
    await expect(getTransactionByHash(HASH, BNB)).resolves.toBeNull()
  })

  it("still returns the transaction when the RPC has it", async () => {
    vi.stubGlobal("fetch", providers("answers-tx"))
    const tx = await getTransactionByHash(HASH, BNB)
    expect(tx?.hash).toBe(HASH)
    expect(tx?.status).toBe("success")
  })

  it("the error names the chain, for the fan-out's unreachable list", async () => {
    vi.stubGlobal("fetch", providers("unreachable"))
    await getTransactionByHash(HASH, BNB).catch((e: LookupUnavailableError) => {
      expect(e.chainId).toBe(BNB)
      expect(e.message).toMatch(/BNB Chain/)
    })
  })
})

describe("diagnoseTransaction, when no chain can be asked", () => {
  it("resolves to lookup_failed with the unreachable chains listed, never to not found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET") }))
    const d = await diagnoseTransaction(HASH)
    expect(d.status).toBe("not_found")
    expect(d.cause, "an outage on every chain is not a finding of absence").toBe("lookup_failed")
    expect(d.unreachableChains?.length).toBeGreaterThan(0)
    expect(d.explanation).toMatch(/none of the candidate chains could be reached/i)
  })

  it("searches Etherlink too, now that the candidate list is derived", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET") }))
    const d = await diagnoseTransaction(HASH)
    expect(d.unreachableChains).toContain("0xa729")
  })
})
