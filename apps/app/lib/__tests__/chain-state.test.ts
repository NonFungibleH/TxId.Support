import { describe, it, expect, vi, afterEach } from "vitest"

// Keep the Aptos branch deterministic and off the network. The point of the
// Aptos cases below is that the EVM change did not touch it.
vi.mock("@txid/aptos", () => ({
  getAptosNetworkStatus: async () => ({ latestVersion: 7050871563 }),
}))

import { chainStateAt } from "@/lib/evidence"

/**
 * An EVM case record must be replayable, the way an Aptos one already was.
 *
 * chainStateAt stamped a ledger version for Aptos and a bare timestamp for
 * every other chain. A timestamp maps to roughly one block, read from a node
 * that may have been lagging, so a BNB Chain record could not be replayed at
 * anything. The deck says "replayable at that ledger version"; that was true
 * for Decibel and false for Yamata.
 *
 * The rules this pins:
 *   - EVM records carry the block number and hash the answer was finalised at
 *   - both spellings of a chain id work, since #69
 *   - any failure degrades to the timestamp: a block is never invented
 *   - the Aptos path is untouched
 */

const BLOCK = { number: "0x7208f3c", hash: "0x" + "ab".repeat(32) }
const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as unknown as Response

afterEach(() => vi.unstubAllGlobals())

describe("chainStateAt on EVM chains", () => {
  it("records the latest block number and hash for BNB Chain", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ jsonrpc: "2.0", id: 1, result: BLOCK })))
    const chain = await chainStateAt("0x38")
    expect(chain?.blockNumber, "a replayable record needs a block").toBe(String(BigInt(BLOCK.number)))
    expect(chain?.blockHash, "a number can be reorged, a hash cannot").toBe(BLOCK.hash)
    expect(chain?.ledgerVersion).toBeUndefined()
  })

  it("asks for the latest block, not a fee or a balance", async () => {
    const fetchMock = vi.fn(async () => okJson({ result: BLOCK }))
    vi.stubGlobal("fetch", fetchMock)
    await chainStateAt("0x38")
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]?.body)) as { method: string; params: unknown[] }
    expect(body.method).toBe("eth_getBlockByNumber")
    expect(body.params).toEqual(["latest", false])
  })

  it("works with the decimal spelling of the chain id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ result: BLOCK })))
    const chain = await chainStateAt("56")
    expect(chain?.blockNumber).toBe(String(BigInt(BLOCK.number)))
  })

  it("stores the block number as a decimal string, the way humans read it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ result: BLOCK })))
    const chain = await chainStateAt("0x38")
    expect(chain?.blockNumber).toMatch(/^\d+$/)
  })
})

describe("chainStateAt never invents a block", () => {
  it("degrades to the timestamp when the RPC returns an error status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response))
    const chain = await chainStateAt("0x38")
    expect(chain).toBeDefined()
    expect(chain).not.toHaveProperty("blockNumber")
    expect(chain).not.toHaveProperty("blockHash")
    expect(chain?.readAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("degrades to the timestamp when the RPC times out", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("The operation was aborted due to timeout") }))
    const chain = await chainStateAt("0x38")
    expect(chain).not.toHaveProperty("blockNumber")
  })

  it("degrades to the timestamp when the node answers without a block", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ result: null })))
    const chain = await chainStateAt("0x38")
    expect(chain).not.toHaveProperty("blockNumber")
  })

  it("does not call an RPC for a chain with none configured", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const chain = await chainStateAt("solana")
    expect(fetchMock).not.toHaveBeenCalled()
    expect(chain).toEqual({ chainId: "solana", readAt: expect.any(String) })
  })

  it("returns undefined for no chain at all", async () => {
    expect(await chainStateAt(undefined)).toBeUndefined()
  })
})

describe("the Aptos path is untouched", () => {
  it("still records a ledger version and never calls an EVM RPC", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    const chain = await chainStateAt("aptos")
    expect(chain?.ledgerVersion).toBe("7050871563")
    expect(chain).not.toHaveProperty("blockNumber")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
