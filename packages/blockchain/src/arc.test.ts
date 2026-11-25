import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { CHAIN_CONFIGS, nativeSymbol } from "./types"
import { getNativeBalance, getRecentTransactions, getTokenBalances } from "./wallet"
import { rpcSentHistory } from "./rpc-history"
import { diagnosePendingTx } from "./pending"
import { ARC, routedTargets, readUsdcBlocklisted, arcRevertExplanation } from "./arc"

/**
 * Arc, Circle's L1 (chain 5042), measured live on 2026-11-25 before any of
 * this was written. Four facts drive everything here, and each one turns a
 * generic EVM answer into a wrong one on Arc:
 *
 *  1. Gas is USDC, held natively at 18 decimals. The USDC ERC-20 at 0x3600…
 *     is the SAME balance through a 6-decimal interface, so listing it as a
 *     separate holding doubles the user's money.
 *  2. A transaction priced under the 20 gwei floor is discarded with no error
 *     and no receipt, and a blocklisted sender is refused before it runs. Both
 *     leave a hash the network has never seen, which is not "dropped, resubmit".
 *  3. Memo and Multicall3From forward calls while keeping the user's wallet as
 *     the sender, so `tx.to` is the router and the real contract is inside.
 *  4. No indexer covers Arc for free (Moralis and Blockscout do not; Etherscan
 *     is paid), but the public RPC keeps archive state, so a wallet's sent
 *     history can be walked by nonce, failures included, with the count exact.
 */
const ARC_ID = "0x13b2"
const WALLET = "0x" + "a".repeat(40)

const rpcJson = (result: unknown) => ({ jsonrpc: "2.0", id: 1, result })
const res = (b: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => b, headers: new Headers() }) as unknown as Response

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("Arc is registered the way its coverage actually is", () => {
  it("is chain 5042 under both spellings, with USDC as its native token", () => {
    expect(CHAIN_CONFIGS[ARC_ID]?.name).toBe("Arc")
    expect(CHAIN_CONFIGS["5042"]?.name).toBe("Arc")
    expect(nativeSymbol(ARC_ID)).toBe("USDC")
  })

  it("has no free indexer, so it takes the RPC route with nonce-walk history", () => {
    const c = CHAIN_CONFIGS[ARC_ID]!
    expect(c.moralisChain).toBeUndefined()
    expect(c.blockscoutApi).toBeUndefined()
    expect(c.rpcHistory).toBe(true)
    expect(c.rpcUrl).toMatch(/^https:\/\//)
  })

  it("reads the native balance at 18 decimals, as Arc stores it", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(rpcJson("0x" + (5n * 10n ** 18n).toString(16)))))
    const b = await getNativeBalance(WALLET, ARC_ID)
    expect(b.balanceFormatted).toBe("5")
    expect(b.symbol).toBe("USDC")
  })
})

describe("calls routed through Memo and Multicall3From are attributed to their real target", () => {
  const word = (hex: string) => hex.replace(/^0x/, "").toLowerCase().padStart(64, "0")
  const TARGET_A = "0x" + "1".repeat(40)
  const TARGET_B = "0x" + "2".repeat(40)

  it("a direct call is its own target", () => {
    expect(routedTargets(TARGET_A, "0xa9059cbb" + "00".repeat(64))).toEqual([TARGET_A])
  })

  it("Memo.memo(target, …) is attributed to the target", () => {
    // memo(address target, bytes data, bytes32 memoId, bytes memoData)
    const input = "0xc3b2c4f8" + word(TARGET_A) + word("80") + word("ab") + word("c0") + word("0") + word("0")
    expect(routedTargets(ARC.MEMO, input)).toEqual([TARGET_A])
  })

  it("Multicall3From.aggregate3 is attributed to every subcall's target", () => {
    // aggregate3((address,bool,bytes)[]): offset, length, two tuple offsets, two tuples
    const tuple = (t: string) => word(t) + word("0") + word("60") + word("0")
    const input = "0x82ad56cb" + word("20") + word("2") + word("40") + word("c0") + tuple(TARGET_A) + tuple(TARGET_B)
    expect(routedTargets(ARC.MULTICALL3_FROM, input)).toEqual([TARGET_A, TARGET_B])
  })

  it("malformed routed calldata falls back to the router rather than inventing a target", () => {
    expect(routedTargets(ARC.MEMO, "0xc3b2c4f8")).toEqual([ARC.MEMO])
    expect(routedTargets(ARC.MULTICALL3_FROM, "0x82ad56cb" + word("ffff"))).toEqual([ARC.MULTICALL3_FROM])
  })
})

/**
 * A fake archive node: the wallet sent three transactions, at blocks 100, 250
 * and 900; the middle one failed. eth_getTransactionCount answers from that
 * schedule at any block, which is all the walk needs.
 */
function fakeArchive(sent: { block: number; status: "0x1" | "0x0" }[], latest = 1000) {
  const nonceAt = (b: number) => sent.filter(s => s.block <= b).length
  const txAt = (b: number) => sent.findIndex(s => s.block === b)
  const answer = (m: string, p: unknown[]) => {
    if (m === "eth_blockNumber") return "0x" + latest.toString(16)
    if (m === "eth_getTransactionCount") {
      const tag = p[1] as string
      return "0x" + nonceAt(tag === "latest" ? latest : parseInt(tag, 16)).toString(16)
    }
    if (m === "eth_getBlockByNumber") {
      const b = parseInt(p[0] as string, 16)
      const i = txAt(b)
      return {
        number: "0x" + b.toString(16),
        timestamp: "0x" + (1_790_000_000 + b).toString(16),
        transactions: i < 0 ? [] : [{
          hash: "0x" + String(b).padStart(64, "0"), from: WALLET, to: "0x" + "3".repeat(40),
          nonce: "0x" + i.toString(16), value: "0x0", gas: "0x30d40", input: "0x12345678", blockNumber: "0x" + b.toString(16),
        }],
      }
    }
    if (m === "eth_getTransactionReceipt") {
      const b = parseInt(String(p[0]).slice(2), 10)
      return { status: sent[txAt(b)]!.status, gasUsed: "0x9c40", blockNumber: "0x" + b.toString(16) }
    }
    return null
  }
  return vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    if (Array.isArray(body)) return res(body.map((c: { id: number; method: string; params: unknown[] }) => ({ jsonrpc: "2.0", id: c.id, result: answer(c.method, c.params) })))
    return res({ jsonrpc: "2.0", id: body.id, result: answer(body.method, body.params) })
  })
}

describe("a wallet's sent history comes from the archive node, failures included", () => {
  const SENT = [{ block: 100, status: "0x1" as const }, { block: 250, status: "0x0" as const }, { block: 900, status: "0x1" as const }]

  it("finds every sent transaction, newest first, with the failure marked", async () => {
    vi.stubGlobal("fetch", fakeArchive(SENT))
    const txs = await getRecentTransactions(WALLET, ARC_ID, 10)
    expect(txs.map(t => Number(t.blockNumber))).toEqual([900, 250, 100])
    expect(txs.map(t => t.status)).toEqual(["success", "failed", "success"])
    expect(txs[0]!.value).toMatch(/USDC$/)
  })

  it("stops at the limit, and the exact count says the history was not read in full", async () => {
    vi.stubGlobal("fetch", fakeArchive(SENT))
    const h = await rpcSentHistory(WALLET, ARC_ID, 2)
    expect(h.txs).toHaveLength(2)
    expect(h.sent).toBe(3)
  })

  it("reads the whole history when the limit allows, and the count proves it", async () => {
    vi.stubGlobal("fetch", fakeArchive(SENT))
    const h = await rpcSentHistory(WALLET, ARC_ID, 10)
    expect(h.txs.length).toBe(h.sent)
  })

  it("an unused wallet is an empty history the nonce proves, not a guess", async () => {
    vi.stubGlobal("fetch", fakeArchive([]))
    expect(await rpcSentHistory(WALLET, ARC_ID, 10)).toEqual({ sent: 0, txs: [] })
  })

  // THE ABSENCE RULE. A node that did not answer is not an empty wallet.
  it("an unreachable node is unavailable, never an empty history", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout") }))
    await expect(rpcSentHistory(WALLET, ARC_ID, 10)).rejects.toThrow()
    await expect(getRecentTransactions(WALLET, ARC_ID, 10)).rejects.toThrow()
  })
})

describe("token balances never count the user's USDC twice", () => {
  it("checks the known Arc tokens and never lists the USDC ERC-20 interface as a separate holding", async () => {
    const seen: string[] = []
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      const calls = Array.isArray(body) ? body : [body]
      return res(calls.map((c: { id: number; params: [{ to: string }] }) => {
        seen.push(c.params[0].to.toLowerCase())
        // EURC holds 12.5; everything else holds nothing.
        const v = c.params[0].to.toLowerCase() === ARC.EURC.toLowerCase() ? 12_500_000n : 0n
        return { jsonrpc: "2.0", id: c.id, result: "0x" + v.toString(16).padStart(64, "0") }
      }))
    }))
    const tokens = await getTokenBalances(WALLET, ARC_ID)
    expect(seen).not.toContain(ARC.USDC.toLowerCase())
    expect(tokens.map(t => [t.symbol, t.balanceFormatted])).toEqual([["EURC", "12.5"]])
  })

  it("a failed balance read throws rather than reporting no tokens", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res({}, 503)))
    await expect(getTokenBalances(WALLET, ARC_ID)).rejects.toThrow()
  })
})

describe("a hash Arc has never seen is explained in Arc's terms", () => {
  const unknownHash = (blocklisted: boolean | "fail") => vi.fn(async (_u: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    if (body.method === "eth_getTransactionByHash") return res(rpcJson(null))
    if (body.method === "eth_getBalance") return res(rpcJson("0x" + (10n ** 18n).toString(16)))
    if (body.method === "eth_call") {
      if (blocklisted === "fail") return res({}, 503)
      return res(rpcJson("0x" + (blocklisted ? 1n : 0n).toString(16).padStart(64, "0")))
    }
    return res(rpcJson(null))
  })

  it("names the 20 gwei floor and the blocklist, not a generic mempool drop", async () => {
    vi.stubGlobal("fetch", unknownHash(false))
    const d = await diagnosePendingTx("0x" + "b".repeat(64), ARC_ID, WALLET)
    expect(d?.cause).toBe("dropped")
    expect(d?.reason).toMatch(/20 gwei/)
    expect(d?.reason).not.toMatch(/resubmit/i)
  })

  it("says plainly when the sending wallet is on the USDC blocklist", async () => {
    vi.stubGlobal("fetch", unknownHash(true))
    const d = await diagnosePendingTx("0x" + "b".repeat(64), ARC_ID, WALLET)
    expect(d?.cause).toBe("sender_blocklisted")
  })

  it("never claims the wallet is restricted when that check did not answer", async () => {
    vi.stubGlobal("fetch", unknownHash("fail"))
    const d = await diagnosePendingTx("0x" + "b".repeat(64), ARC_ID, WALLET)
    expect(d?.cause).toBe("dropped")
    expect(await readUsdcBlocklisted(WALLET, ARC_ID)).toEqual({ kind: "unavailable" })
  })
})

describe("Arc's own revert messages get Arc's own explanation", () => {
  it("explains the blocklist and the zero address, and nothing else", () => {
    expect(arcRevertExplanation("Blocked address")?.fix).toMatch(/will not change/)
    expect(arcRevertExplanation("Zero address not allowed")?.explanation).toMatch(/zero address/i)
    expect(arcRevertExplanation("Too little received")).toBeNull()
  })
})
