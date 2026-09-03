import { describe, it, expect, vi, afterEach } from "vitest"
import { diagnosePendingTx } from "./pending"

/**
 * An unreachable node is not a node that has never seen the hash.
 *
 * diagnosePendingTx asks the chain's public RPC about a hash the indexer could
 * not return as mined. The RPC helper returned `null` both when the node
 * replied null (a fact: it has never seen this hash) and when the request
 * timed out or errored (no fact at all). The probe fell through to DROPPED
 * for both, and the resolver renders DROPPED as custody unchanged, retryable
 * yes, "it never executed, so nothing moved, submit it again".
 *
 * For a transaction that had actually succeeded, during an outage of a free
 * public endpoint with no SLA, that is an instruction to execute it twice.
 *
 * These pin the three things the node can do, as three different answers.
 */

const HASH = "0x484cf93b31ffe7c01bfa04a241dd0e0f62309768e538c6dbbd17f5368a863538"
const BNB = "0x38"

const reply = (result: unknown) =>
  ({ ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, result }) }) as unknown as Response

afterEach(() => vi.unstubAllGlobals())

describe("diagnosePendingTx tells silence apart from a null answer", () => {
  it("a node that TIMES OUT is lookup_failed, never dropped", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("The operation was aborted due to timeout") }))
    const diag = await diagnosePendingTx(HASH, BNB)
    expect(diag?.cause, "a timeout must not read as 'the network does not know this hash'").toBe("lookup_failed")
  })

  it("a node that returns HTTP 503 is lookup_failed, never dropped", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response))
    const diag = await diagnosePendingTx(HASH, BNB)
    expect(diag?.cause).toBe("lookup_failed")
  })

  it("a node that returns a JSON-RPC error is lookup_failed, never dropped", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      ({ ok: true, json: async () => ({ jsonrpc: "2.0", id: 1, error: { code: -32005, message: "rate limited" } }) }) as unknown as Response,
    ))
    const diag = await diagnosePendingTx(HASH, BNB)
    expect(diag?.cause).toBe("lookup_failed")
  })

  it("a node that ANSWERS null is still dropped, because that is a real answer", async () => {
    // The fix must not make every not-found suspicious, or a genuinely dropped
    // transaction would never be diagnosed again.
    vi.stubGlobal("fetch", vi.fn(async () => reply(null)))
    const diag = await diagnosePendingTx(HASH, BNB)
    expect(diag?.cause).toBe("dropped")
  })

  it("a node that reports the tx in its mempool still diagnoses it as pending", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string | URL, init?: RequestInit) => {
      const { method } = JSON.parse(String(init?.body)) as { method: string }
      if (method === "eth_getTransactionByHash") {
        return reply({ blockNumber: null, from: "0xabc", nonce: "0x5", maxFeePerGas: "0x3b9aca00" })
      }
      if (method === "eth_getTransactionCount") return reply("0x5")
      if (method === "eth_gasPrice") return reply("0x3b9aca00")
      if (method === "eth_getBlockByNumber") return reply({ baseFeePerGas: "0x3b9aca00" })
      return reply(null)
    }))
    const diag = await diagnosePendingTx(HASH, BNB)
    expect(diag?.cause).toBe("pending_congestion")
  })

  it("the lookup_failed reason says it is our failure, in words a model cannot misread", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 502 }) as Response))
    const diag = await diagnosePendingTx(HASH, BNB)
    expect(diag?.reason).toMatch(/could not be reached/i)
    expect(diag?.reason).toMatch(/not a statement about the transaction/i)
  })
})
