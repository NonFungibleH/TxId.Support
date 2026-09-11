import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { getTransactionByHash, getNativeBalance, LookupUnavailableError } from "./wallet"
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

// ── The error takes a chain id, and was being handed whole sentences ────────

/**
 * Found auditing the chain work, 2026-09-11, after Robinhood Chain's node
 * answered HTTP 200 with the plain text "upstream connect error" under load.
 *
 * The constructor takes a chainId and builds
 * `Could not reach ${name} to look up the transaction` around it. Three call
 * sites in wallet.ts pass a whole sentence instead, so the user gets:
 *
 *   "Could not reach could not read the Robinhood Chain balance: Unexpected
 *    token u to look up the transaction"
 *
 * and `error.chainId`, which the test above relies on being a chain id, holds
 * a sentence. A reason is a real thing to want here; it just needs its own
 * parameter rather than the one that is already spoken for.
 */
describe("the message a user actually reads", () => {
  const garbled = /Could not reach (could not|the .* node|No indexer)/

  it("is a sentence when no reason is given", () => {
    const e = new LookupUnavailableError(BNB)
    expect(e.message).toBe("Could not reach BNB Chain to look up the transaction")
    expect(e.chainId).toBe(BNB)
  })

  it("is the reason itself when one is given, not a reason wrapped in a sentence", () => {
    const e = new LookupUnavailableError(BNB, "the BNB Chain node did not return a balance")
    expect(e.message).toBe("the BNB Chain node did not return a balance")
    expect(e.message).not.toMatch(garbled)
  })

  it("keeps chainId a chain id even when a reason is given", () => {
    const e = new LookupUnavailableError(BNB, "anything at all")
    expect(e.chainId).toBe(BNB)
  })

  it("produces no garbled message from the balance path", async () => {
    // The live shape: a 200 whose body is prose.
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => { throw new SyntaxError("Unexpected token 'u'") },
    }) as unknown as Response))
    try {
      await getNativeBalance("0x0000000000000000000000000000000000000001", BNB)
      throw new Error("expected it to throw")
    } catch (e) {
      expect(e).toBeInstanceOf(LookupUnavailableError)
      const err = e as InstanceType<typeof LookupUnavailableError>
      expect(err.message).not.toMatch(garbled)
      expect(err.chainId).toBe(BNB)
    }
  })
})
