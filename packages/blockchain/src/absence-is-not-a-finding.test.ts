import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { getWalletApprovals, getTransactionByHash } from "./wallet"

/**
 * One bug, wearing different clothes.
 *
 * Every incident this week reduces to the same mistake: something we FAILED TO
 * LEARN was reported as something we HAD LEARNED.
 *
 *   - An indexer outage became "your transaction never happened" (#68)
 *   - An unrecognised chain became Ethereum, so a BNB transaction "did not
 *     exist" (#69)
 *   - A failed approvals read became "you have no approvals"
 *
 * The third is the worst of them, and it is the reason this file is about the
 * CLASS rather than about approvals. The first two resolve toward alarm, so a
 * user pushes back and someone investigates. An all-clear resolves toward
 * safety: nobody questions it, and the person who asked what they had approved
 * because they thought they had been drained simply does not revoke.
 *
 * So the rule these tests exist to enforce:
 *
 *   A LOOKUP THAT DID NOT COMPLETE MUST NEVER BE REPRESENTED AS A FINDING.
 *
 * Empty, zero, false and null are all findings. None of them may be produced
 * by a failure. Add a case here whenever a new read is added, and make it fail
 * before you make it pass.
 */

const WALLET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045"
const HASH = "0x484cf93b31ffe7c01bfa04a241dd0e0f62309768e538c6dbbd17f5368a863538"
const BNB = "0x38"

const okJson = (body: unknown) => ({ ok: true, status: 200, json: async () => body } as unknown as Response)

beforeEach(() => vi.stubEnv("MORALIS_API_KEY", "test-key"))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("approvals: a failed read is not an all-clear", () => {
  it("an indexer outage does not become 'no approvals'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 503 }) as Response))
    const lookup = await getWalletApprovals(WALLET, BNB)
    expect(lookup.status, "a 503 must not read as a clean wallet").toBe("unavailable")
    expect(lookup).not.toHaveProperty("approvals")
  })

  it("a network failure does not become 'no approvals'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNRESET") }))
    const lookup = await getWalletApprovals(WALLET, BNB)
    expect(lookup.status).toBe("unavailable")
  })

  it("a MISSING API KEY does not become 'no approvals'", async () => {
    // moralisHeaders() throws when the key is unset. That throw used to be
    // caught and returned as [], so a misconfigured deploy told every user
    // their wallet had no approvals.
    vi.unstubAllEnvs()
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ result: [] })))
    const lookup = await getWalletApprovals(WALLET, BNB)
    expect(lookup.status, "a missing key is our failure, not a fact about the wallet").toBe("unavailable")
  })

  it("a chain with no approvals endpoint says so, rather than 'none'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ result: [] })))
    // Etherlink routes through Blockscout, which has no approvals endpoint.
    const lookup = await getWalletApprovals(WALLET, "0xa729")
    expect(lookup.status).toBe("unsupported")
  })

  it("but a wallet that really has approved nothing still reports none", async () => {
    // The point is not to make every empty answer suspicious. A real empty
    // result must stay reportable, or the distinction is worthless.
    vi.stubGlobal("fetch", vi.fn(async () => okJson({ result: [] })))
    const lookup = await getWalletApprovals(WALLET, BNB)
    expect(lookup.status).toBe("ok")
    expect(lookup.status === "ok" && lookup.approvals).toEqual([])
  })

  it("and a wallet with approvals reports them", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => okJson({
      result: [{
        token: { address: "0xtoken", symbol: "USDT" },
        spender: { address: "0xspender", entity: "Some Router" },
        value: "115792089237316195423570985008687907853269984665640564039457584007913129639935",
      }],
    })))
    const lookup = await getWalletApprovals(WALLET, BNB)
    expect(lookup.status).toBe("ok")
    expect(lookup.status === "ok" && lookup.approvals.length).toBe(1)
    expect(lookup.status === "ok" && lookup.approvals[0]!.isUnlimited).toBe(true)
  })
})

describe("transactions: a failed read is not a missing transaction", () => {
  it("an indexer outage falls through to the chain rather than returning null", async () => {
    // Pinned in wallet-fallback.test.ts too. Repeated here because this file is
    // the register of the class, and a reader should see all of it in one place.
    const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes("moralis")) return { ok: false, status: 429 } as Response
      const body = JSON.parse(String(init?.body ?? "{}")) as { method: string }
      if (body.method === "eth_getTransactionByHash") {
        return okJson({ result: { hash: HASH, blockNumber: "0x71fd21c", from: "0xabc", to: "0xdef", value: "0x0", gas: "0x30d40", input: "0x" } })
      }
      if (body.method === "eth_getTransactionReceipt") return okJson({ result: { gasUsed: "0x9c40", status: "0x1" } })
      if (body.method === "eth_getBlockByNumber") return okJson({ result: { timestamp: "0x66d0a000" } })
      return okJson({ result: null })
    })
    vi.stubGlobal("fetch", fetchMock)
    const tx = await getTransactionByHash(HASH, BNB)
    expect(tx, "an outage must not read as 'no such transaction'").not.toBeNull()
  })

  it("only the CHAIN saying it has never seen the hash produces null", async () => {
    // This is the one case where null is a finding rather than a failure, and
    // it has to keep working or the fallback would mask real not-founds.
    vi.stubGlobal("fetch", vi.fn(async (url: string | URL) => {
      if (String(url).includes("moralis")) return { ok: false, status: 404 } as Response
      return okJson({ result: null })
    }))
    const tx = await getTransactionByHash(HASH, BNB)
    expect(tx, "the chain itself denying the hash IS a real answer").toBeNull()
  })
})
