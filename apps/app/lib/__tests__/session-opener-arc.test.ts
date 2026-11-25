import { describe, it, expect, vi } from "vitest"

/**
 * The opener is the first thing a user reads when they connect, so on Arc it
 * must not do what the generic EVM path did: call a busy wallet "no activity"
 * because the protocol was not in the handful of transactions read. Arc's
 * history comes from a nonce walk, whose count is exact, so "no activity" is
 * claimed only when every transaction the wallet ever sent was read.
 */
// A plain function, not vi.fn: under Vitest 2.1 a vi.fn that rejects is
// reported as a failure even when the code under test catches it.
let sentHistory: () => Promise<unknown> = async () => ({ sent: 0, txs: [] })
vi.mock("@txid/blockchain", async () => {
  const real = await vi.importActual<typeof import("@txid/blockchain")>("@txid/blockchain")
  return { ...real, rpcSentHistory: () => sentHistory(), getRecentTransactions: vi.fn() }
})
vi.mock("@/lib/protocol-account", () => ({ resolveProtocolAccount: async () => ({ status: "off" }) }))

import { buildSessionOpener } from "@/lib/session-opener"
import type { ProjectConfig } from "@/lib/types/config"

const POOL = "0x" + "c".repeat(40)
const MEMO = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505"
const WALLET = "0x" + "a".repeat(40)
const config = { watchedContracts: [{ id: "p", name: "Pool", chain: "0x13b2", address: POOL, description: "" }] } as unknown as ProjectConfig

const tx = (over: Record<string, unknown>) => ({
  hash: "0x1", blockNumber: "1", timestamp: new Date().toISOString(), age: "1 minute ago",
  from: WALLET, to: "0x" + "d".repeat(40), value: "0 USDC", gasLimit: "1", gasUsed: "1",
  status: "success", summary: "", ...over,
})

describe("the connect greeting on Arc", () => {
  it("says nothing, rather than 'no activity', when older history was not read", async () => {
    sentHistory = async () => ({ sent: 40, txs: [tx({}), tx({}), tx({}), tx({}), tx({})] })
    expect(await buildSessionOpener(config, WALLET, "0x13b2", "Pool")).toBeNull()
  })

  it("says 'no activity' when the exact count proves it", async () => {
    sentHistory = async () => ({ sent: 0, txs: [] })
    const o = await buildSessionOpener(config, WALLET, "0x13b2", "Pool")
    expect(o?.scenario).toBe("no_activity")
  })

  it("counts a call routed through Memo as activity on the protocol inside it", async () => {
    sentHistory = async () => ({ sent: 1, txs: [tx({ to: MEMO, targets: [POOL] })] })
    const o = await buildSessionOpener(config, WALLET, "0x13b2", "Pool")
    expect(o?.scenario).toBe("active")
  })

  it("says nothing when the history read failed", async () => {
    sentHistory = async () => { throw new Error("node down") }
    expect(await buildSessionOpener(config, WALLET, "0x13b2", "Pool")).toBeNull()
  })
})
