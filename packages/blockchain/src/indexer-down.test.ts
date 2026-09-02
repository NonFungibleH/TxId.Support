import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import {
  getNativeBalance,
  getTokenBalances,
  getRecentTransactions,
  getTransactionByHash,
  getWalletApprovals,
} from "./wallet"

/**
 * Every wallet read, with the indexer completely down.
 *
 * The per-function tests each pin one path. This one asks the question a
 * customer actually cares about: when Moralis is unavailable, does ANY read
 * invent an answer?
 *
 * There are exactly two acceptable outcomes for each:
 *
 *   1. It succeeds anyway, through the chain's own RPC.
 *   2. It fails in a way the caller cannot mistake for data.
 *
 * There is no third option. A zero balance, an empty token list, an empty
 * transaction history and an empty approvals list are all FINDINGS, and a
 * failure must not be able to produce one. This matters more than it sounds:
 * the Alchemy dashboard on 2026-09-02 showed a third of one app's provider
 * calls failing, and TxID's own indexer had already produced the "your
 * transaction never happened" incident. Provider failure is the normal case,
 * not the edge case.
 *
 * Written to run WITHOUT network access so it guards every PR, unlike
 * live-check.test.ts which needs LIVE=1 and real endpoints.
 */

const WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
const HASH = "0x484cf93b31ffe7c01bfa04a241dd0e0f62309768e538c6dbbd17f5368a863538"
const BNB = "0x38"

/** Moralis is dead. The chain's own RPC still answers. */
function indexerDown() {
  return vi.fn(async (url: string | URL, init?: RequestInit) => {
    if (String(url).includes("moralis")) return { ok: false, status: 503 } as Response
    const body = JSON.parse(String(init?.body ?? "{}")) as { method?: string }
    const reply = (result: unknown) => ({ ok: true, json: async () => ({ result }) } as unknown as Response)
    if (body.method === "eth_getTransactionByHash") {
      return reply({
        hash: HASH, blockNumber: "0x71fd21c", from: "0xabc", to: "0xdef",
        value: "0x0", gas: "0x30d40", input: "0x",
      })
    }
    if (body.method === "eth_getTransactionReceipt") return reply({ gasUsed: "0x9c40", status: "0x1" })
    if (body.method === "eth_getBlockByNumber") return reply({ timestamp: "0x66d0a000" })
    return reply(null)
  })
}

beforeEach(() => vi.stubEnv("MORALIS_API_KEY", "test-key"))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

/**
 * Did this read either work, or fail loudly? Anything else is the bug.
 * Returns "answered" or "refused", and THROWS the original failure if the
 * function fabricated a plausible-looking empty result instead.
 */
async function mustNotFabricate<T>(
  label: string,
  read: () => Promise<T>,
  looksFabricated: (value: T) => boolean,
): Promise<"answered" | "refused"> {
  let value: T
  try {
    value = await read()
  } catch {
    // A thrown error cannot be mistaken for data. That is a pass.
    return "refused"
  }
  expect(looksFabricated(value), `${label} invented an answer while the indexer was down`).toBe(false)
  return "answered"
}

describe("with the indexer down, nothing invents an answer", () => {
  it("native balance", async () => {
    vi.stubGlobal("fetch", indexerDown())
    const outcome = await mustNotFabricate(
      "getNativeBalance",
      () => getNativeBalance(WALLET, BNB),
      // A zero balance is a finding. It must not come from an outage.
      b => b.balance === "0",
    )
    expect(["answered", "refused"]).toContain(outcome)
  })

  it("token balances", async () => {
    vi.stubGlobal("fetch", indexerDown())
    await mustNotFabricate(
      "getTokenBalances",
      () => getTokenBalances(WALLET, BNB),
      // "You hold no tokens" is a finding, and a serious one to get wrong.
      t => Array.isArray(t) && t.length === 0,
    )
  })

  it("recent transactions", async () => {
    vi.stubGlobal("fetch", indexerDown())
    await mustNotFabricate(
      "getRecentTransactions",
      () => getRecentTransactions(WALLET, BNB),
      // "You have no recent activity" told to someone whose swap just failed.
      t => Array.isArray(t) && t.length === 0,
    )
  })

  it("approvals", async () => {
    vi.stubGlobal("fetch", indexerDown())
    await mustNotFabricate(
      "getWalletApprovals",
      () => getWalletApprovals(WALLET, BNB),
      l => l.status === "ok" && l.approvals.length === 0,
    )
  })

  it("a transaction by hash, which must SUCCEED rather than merely refuse", async () => {
    // The others may honestly refuse. This one has an RPC fallback and is the
    // path that produced the original incident, so refusing is not good enough.
    vi.stubGlobal("fetch", indexerDown())
    const tx = await getTransactionByHash(HASH, BNB)
    expect(tx, "the RPC fallback must carry this read when the indexer is down").not.toBeNull()
    expect(tx!.status).toBe("success")
  })
})

describe("with NO API KEY at all, the same holds", () => {
  // A misconfigured deploy is indistinguishable from an outage to a user, and
  // has happened: MORALIS_API_KEY was set but failing on 2026-09-02.
  beforeEach(() => vi.unstubAllEnvs())

  it("approvals refuse rather than report an empty wallet", async () => {
    vi.stubGlobal("fetch", indexerDown())
    const lookup = await getWalletApprovals(WALLET, BNB)
    expect(lookup.status).toBe("unavailable")
  })

  it("a transaction is still found, because the RPC needs no key", async () => {
    vi.stubGlobal("fetch", indexerDown())
    const tx = await getTransactionByHash(HASH, BNB)
    expect(tx, "a missing key must not read as a missing transaction").not.toBeNull()
  })
})
