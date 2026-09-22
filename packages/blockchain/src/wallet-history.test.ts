import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { readWalletHistory } from "./wallet"

/**
 * readWalletHistory exists for callers that conclude "this wallet has never
 * done X". That conclusion needs two answers getRecentTransactions cannot give:
 * did the read complete, and was it the whole history. Both are pinned here.
 */

const WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
const ETH = "0x1"
const ETHERLINK = "0xa729"

const moralisTx = (i: number) => ({
  hash: `0x${i.toString(16).padStart(64, "0")}`,
  block_number: "1",
  block_timestamp: "2026-09-01T00:00:00.000Z",
  from_address: WALLET,
  to_address: "0x0000000000000000000000000000000000000001",
  value: "0",
  gas: "21000",
  receipt_gas_used: "21000",
  receipt_status: "1",
})

const bsTx = (i: number) => ({
  hash: `0x${i.toString(16).padStart(64, "0")}`,
  block_number: 1,
  timestamp: "2026-09-01T00:00:00.000Z",
  from: { hash: WALLET },
  to: { hash: "0x0000000000000000000000000000000000000001" },
  value: "0",
  gas_limit: "21000",
  gas_used: "21000",
  status: "ok",
})

function respond(body: unknown, ok = true) {
  return vi.fn(async () => ({ ok, status: ok ? 200 : 503, json: async () => body }) as unknown as Response)
}

beforeEach(() => vi.stubEnv("MORALIS_API_KEY", "test-key"))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("readWalletHistory", () => {
  it("reports a failed indexer read as unavailable, never as an empty history", async () => {
    vi.stubGlobal("fetch", respond({}, false))
    expect(await readWalletHistory(WALLET, ETH, 100)).toEqual({ kind: "unavailable" })
  })

  it("reports a thrown fetch as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout") }))
    expect((await readWalletHistory(WALLET, ETH, 100)).kind).toBe("unavailable")
  })

  it("calls a short page the whole history", async () => {
    vi.stubGlobal("fetch", respond({ result: [moralisTx(1), moralisTx(2)] }))
    const r = await readWalletHistory(WALLET, ETH, 100)
    expect(r).toMatchObject({ kind: "ok", complete: true })
    if (r.kind === "ok") expect(r.txs).toHaveLength(2)
  })

  it("does not call a full page the whole history", async () => {
    vi.stubGlobal("fetch", respond({ result: Array.from({ length: 100 }, (_, i) => moralisTx(i)), cursor: "next" }))
    expect(await readWalletHistory(WALLET, ETH, 100)).toMatchObject({ kind: "ok", complete: false })
  })

  it("says unsupported for a chain it has no history source for", async () => {
    vi.stubGlobal("fetch", respond({}))
    expect((await readWalletHistory(WALLET, "0xdeadbeef", 100)).kind).toBe("unsupported")
  })

  // The Blockscout path is the one that used to turn a failure into [].
  it("reports a failed Blockscout read as unavailable, not as an empty wallet", async () => {
    vi.stubGlobal("fetch", respond({}, false))
    expect(await readWalletHistory(WALLET, ETHERLINK, 100)).toEqual({ kind: "unavailable" })
  })

  it("uses Blockscout's next page marker for completeness", async () => {
    vi.stubGlobal("fetch", respond({ items: [bsTx(1)], next_page_params: null }))
    expect(await readWalletHistory(WALLET, ETHERLINK, 100)).toMatchObject({ kind: "ok", complete: true })
    vi.stubGlobal("fetch", respond({ items: [bsTx(1)], next_page_params: { block_number: 1 } }))
    expect(await readWalletHistory(WALLET, ETHERLINK, 100)).toMatchObject({ kind: "ok", complete: false })
  })
})
