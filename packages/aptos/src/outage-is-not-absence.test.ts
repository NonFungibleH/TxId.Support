import { describe, it, expect, vi, afterEach } from "vitest"
import { AptosLookupUnavailableError } from "./errors"
import { getAptosTransactionByHash } from "./fullnode"
import { diagnoseAptosWallet, getAptosRecentTransactions } from "./indexer"

/**
 * The Aptos read path had the hole #68 and #72 closed on EVM.
 *
 * `aptosGet` collapses a clean 404, a 500, a timeout and an unparseable body
 * into one `null`, and `getAptosTransactionByHash` passed that null straight
 * out. Three callers then rendered it as an absence: the agent listed "aptos"
 * among the chains it had CHECKED, the resolution API resolved to not_found
 * (which carries a custody claim), and the version short-circuit set
 * `status: "not_found"` while hedging only in prose.
 *
 * The fullnode 404s cleanly on a genuine miss, which is how `getAccount`
 * already detects a never-created address, so the two are separable and there
 * was never a reason to conflate them.
 */
const HASH = "0x" + "a".repeat(64)
const A = "0x" + "7".repeat(64)

const res = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: new Headers() }) as unknown as Response

const userTx = (version: string, success = true) => ({
  type: "user_transaction",
  hash: HASH,
  version,
  success,
  vm_status: success ? "Executed successfully" : "Move abort in 0x1::coin: EINSUFFICIENT_BALANCE(0x10006)",
  timestamp: "1757260000000000",
  sender: A,
  payload: { type: "entry_function_payload", function: "0x1::coin::transfer", type_arguments: [] },
  gas_used: "500",
  gas_unit_price: "100",
})

afterEach(() => vi.unstubAllGlobals())

describe("a fullnode that did not answer is not a transaction that does not exist", () => {
  it("a 404 is an ANSWER, and stays null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(404, { message: "not found" })))
    await expect(getAptosTransactionByHash(HASH)).resolves.toBeNull()
  })

  it("a 500 throws, so no caller can read it as an absence", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(500, {})))
    await expect(getAptosTransactionByHash(HASH)).rejects.toBeInstanceOf(AptosLookupUnavailableError)
  })

  it("a node that never answers throws", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up") }))
    await expect(getAptosTransactionByHash(HASH)).rejects.toBeInstanceOf(AptosLookupUnavailableError)
  })

  it("a body that cannot be parsed throws rather than reading as not found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true, status: 200, headers: new Headers(),
      json: async () => { throw new Error("Unexpected token <") },
    }) as unknown as Response))
    await expect(getAptosTransactionByHash(HASH)).rejects.toBeInstanceOf(AptosLookupUnavailableError)
  })

  it("still returns the transaction when the node answers with one", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, userTx("100"))))
    const tx = await getAptosTransactionByHash(HASH)
    expect(tx?.version).toBe("100")
    expect(tx?.success).toBe(true)
  })

  // A hash that resolves to a block metadata or state checkpoint transaction is
  // a real answer: there is no user transaction here.
  it("a non-user transaction is an answer, not an outage", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, { type: "block_metadata_transaction", hash: HASH })))
    await expect(getAptosTransactionByHash(HASH)).resolves.toBeNull()
  })
})

/**
 * The quieter version of the same bug. The index names the versions and the
 * fullnode hydrates them one by one, so a partial outage used to shorten
 * somebody's history invisibly: ten versions in, seven transactions out, and
 * nothing anywhere saying three could not be read.
 */
describe("a history that could not be fully read is not a shorter history", () => {
  /** Index answers with three versions; the fullnode answers for some of them. */
  const withHydration = (answers: Record<string, "ok" | "down">) =>
    vi.fn(async (url: string | URL) => {
      const u = String(url)
      if (u.includes("/graphql")) {
        return res(200, {
          data: { account_transactions: Object.keys(answers).map(v => ({ transaction_version: Number(v) })) },
        })
      }
      const version = u.split("/").pop() ?? ""
      if (answers[version] === "down") return res(503, {})
      return res(200, userTx(version, version !== "3"))
    })

  it("counts the versions the fullnode could not be asked about", async () => {
    vi.stubGlobal("fetch", withHydration({ "1": "ok", "2": "down", "3": "ok" }))
    const h = await getAptosRecentTransactions(A)
    expect(h?.unread).toBe(1)
    expect(h?.transactions.map(t => t.version)).toEqual(["1", "3"])
  })

  it("reports zero unread when every version was read", async () => {
    vi.stubGlobal("fetch", withHydration({ "1": "ok", "2": "ok" }))
    const h = await getAptosRecentTransactions(A)
    expect(h?.unread).toBe(0)
    expect(h?.transactions).toHaveLength(2)
  })

  // A failure count taken from a list known to be short is a wrong count, and
  // the wrong direction: it tells a failing trader they had no recent failures.
  it("refuses to count failures out of an incomplete history", async () => {
    vi.stubGlobal("fetch", withHydration({ "1": "ok", "2": "down", "3": "ok" }))
    const d = await diagnoseAptosWallet(A)
    expect(d.recentFailureCount).toBeNull()
  })

  it("counts failures when the history is complete", async () => {
    vi.stubGlobal("fetch", withHydration({ "1": "ok", "3": "ok" }))
    const d = await diagnoseAptosWallet(A)
    expect(d.recentFailureCount).toBe(1)
  })
})
