import { describe, it, expect, vi, afterEach } from "vitest"
import { isImplicitNearAccount, isNearAccount, isNearTxHash } from "./address"
import { NearLookupUnavailableError } from "./lookup"
import { nearRpc } from "./rpc"

const json = (b: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => b }) as unknown as Response
const ok = (result: unknown) => json({ jsonrpc: "2.0", id: "txid", result })
const err = (cause: string) => json({ jsonrpc: "2.0", id: "txid", error: { cause: { name: cause } } })

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("a node that keeps only recent history cannot report a miss", () => {
  /**
   * THE SOLANA FINDING AGAIN, ON A DIFFERENT CHAIN. Measured 2026-09-08 against
   * identical block heights: rpc.mainnet.near.org and free.rpc.fastnear.com both
   * served 50,000 blocks back and answered UNKNOWN_BLOCK at 200,000, about two
   * days. archival-rpc.mainnet.near.org served 5,000,000 blocks back, keyless.
   *
   * So a pruning node's "I do not have that" is the same response as "that
   * never existed", and the user it reaches is asking about last month.
   */
  it("refuses to call a miss a finding when only pruning nodes were configured", async () => {
    vi.stubEnv("NEAR_RPC_URLS", "https://pruning.test")
    vi.stubGlobal("fetch", vi.fn(async () => err("UNKNOWN_TRANSACTION")))
    const r = await nearRpc("EXPERIMENTAL_tx_status", ["h", "a.near"])
    expect(r.kind).toBe("unavailable")
    if (r.kind === "unavailable") expect(r.reason).toMatch(/keeps? only recent history/)
  })

  /**
   * This test used to say "once an archival node is IN THE LIST", which was
   * the bug rather than the contract: being configured is not the same as
   * having answered. It now proves the node that reported the miss holds
   * block 1.
   */
  it("reports a miss as a finding when the node that answered is archival", async () => {
    vi.stubEnv("NEAR_RPC_URLS", "https://archival-rpc.mainnet.near.org")
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}")
      if (body.method === "block") return ok({ header: { height: 1 } })
      return err("UNKNOWN_TRANSACTION")
    }))
    const r = await nearRpc("EXPERIMENTAL_tx_status", ["h", "a.near"])
    expect(r.kind).toBe("missing")
  })

  // The default list leads with archival precisely so the common path can make
  // a finding at all.
  it("defaults to archival first", async () => {
    const { endpoints } = await import("./rpc")
    expect(endpoints()[0]).toBe("https://archival-rpc.mainnet.near.org")
  })

  /**
   * UNKNOWN_BLOCK is deliberately NOT a finding. On a pruning node it means
   * "outside what I keep", which cannot be told from a height that never
   * existed without knowing the node's retention.
   */
  it("treats UNKNOWN_BLOCK as unavailable, never as absence", async () => {
    vi.stubEnv("NEAR_RPC_URLS", "https://archival-rpc.mainnet.near.org")
    vi.stubGlobal("fetch", vi.fn(async () => err("UNKNOWN_BLOCK")))
    const r = await nearRpc("block", { block_id: 1 })
    expect(r.kind).toBe("unavailable")
  })
})

describe("a node that did not answer is never an answer", () => {
  it("a timeout is unavailable", async () => {
    vi.stubEnv("NEAR_RPC_URLS", "https://a.test")
    vi.stubGlobal("fetch", vi.fn(async () => { const e = new Error("t"); e.name = "TimeoutError"; throw e }))
    const r = await nearRpc("status", [])
    expect(r.kind).toBe("unavailable")
  })

  it("an HTTP failure is unavailable", async () => {
    vi.stubEnv("NEAR_RPC_URLS", "https://a.test")
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 503)))
    expect((await nearRpc("status", [])).kind).toBe("unavailable")
  })

  it("falls through to the next endpoint before giving up", async () => {
    vi.stubEnv("NEAR_RPC_URLS", "https://a.test,https://b.test")
    let n = 0
    vi.stubGlobal("fetch", vi.fn(async () => (++n === 1 ? json({}, 500) : ok({ good: true }))))
    const r = await nearRpc<{ good: boolean }>("status", [])
    expect(r.kind).toBe("ok")
  })

  it("the unwrap helper throws rather than returning a false absence", async () => {
    const { unwrapNear } = await import("./rpc")
    expect(() => unwrapNear({ kind: "unavailable", reason: "x" })).toThrow(NearLookupUnavailableError)
    expect(unwrapNear({ kind: "missing", name: "UNKNOWN_TRANSACTION" })).toBeNull()
  })
})

describe("NEAR account ids are names, which changes routing", () => {
  /**
   * Aptos and Sui addresses are the same shape as each other, and a Stellar
   * transaction hash is an EVM hash without its 0x, so all of those needed the
   * request to name the chain. A NEAR account id cannot be confused with any of
   * them, which is a genuine simplification.
   */
  it("accepts real account names", () => {
    for (const a of ["alice.near", "v2.ref-finance.near", "i6849797610.tg", "game.hot.tg", "a_b-c.near"]) {
      expect(isNearAccount(a), a).toBe(true)
    }
  })

  it("rejects things that are not account names", () => {
    for (const a of ["Alice.near", "a", ".near", "near.", "a..b", "a".repeat(65), "has space"]) {
      expect(isNearAccount(a), a).toBe(false)
    }
  })

  /**
   * An EVM address IS a structurally valid NEAR account name: `0x` plus hex is
   * lowercase alphanumerics, which is exactly what NEAR permits. The validator
   * must not lie about that, so the "did you paste the wrong thing" question is
   * answered separately rather than bent into the spec check.
   */
  it("admits an EVM address is a valid NAME, and flags it as probably foreign", async () => {
    const { looksLikeForeignAddress } = await import("./address")
    const evm = "0x" + "a".repeat(40)
    expect(isNearAccount(evm)).toBe(true)
    expect(looksLikeForeignAddress(evm)).toBe(true)
    expect(looksLikeForeignAddress("alice.near")).toBe(false)
  })

  // The implicit form is 64 lowercase hex with no prefix, which is exactly a
  // Stellar transaction hash. Shape alone can never decide the chain.
  it("flags the implicit form, which collides with a Stellar hash", () => {
    const implicit = "a".repeat(64)
    expect(isImplicitNearAccount(implicit)).toBe(true)
    expect(isNearAccount(implicit)).toBe(true)
  })

  it("does not mistake a 64-hex hash for a NEAR transaction hash", () => {
    // NEAR hashes are base58. A hex string of hash length is another chain's.
    expect(isNearTxHash("f".repeat(64))).toBe(false)
    expect(isNearTxHash("C2bqVtuYgc16oQ464YwQuR8RqdXqaNrbFRNf7hbnyRhj")).toBe(true)
  })
})

describe("a miss counts only if the node that reported it keeps the whole chain", () => {
  /**
   * The guard checked whether ARCHIVAL was IN THE ENDPOINT LIST, not whether
   * the miss came FROM it. Two bugs came out of that.
   *
   * With archival listed but DOWN, a two-day-retention node's
   * UNKNOWN_TRANSACTION was returned as a definite finding and rendered as
   * "an archival NEAR node looked and has no transaction with this hash",
   * which is a claim about evidence that does not exist.
   *
   * And a custom NEAR_RPC_URLS pointing at a perfectly good archival provider
   * that is not that exact hostname downgraded every genuine miss to
   * unavailable, so "this hash was never submitted" became unsayable.
   *
   * It now asks the node that answered whether it holds block 1, and fails
   * closed if it cannot be asked.
   */
  it("a pruning node's miss is unavailable even when archival is configured", async () => {
    // Distinct hostnames per test: the archival cache is keyed by URL and is
    // MEANT to persist, since whether a node prunes does not change.
    vi.stubEnv("NEAR_RPC_URLS", "https://pruning-a.test,https://archival-but-down.test")
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}")
      // The pruning node answers the lookup with a miss...
      if (body.method === "EXPERIMENTAL_tx_status") return err("UNKNOWN_TRANSACTION")
      // ...and does not hold block 1, which is how we know it prunes.
      if (body.method === "block") return err("UNKNOWN_BLOCK")
      return json({}, 500)
    }))
    const r = await nearRpc("EXPERIMENTAL_tx_status", ["h", "a.near"])
    expect(r.kind).toBe("unavailable")
    if (r.kind === "unavailable") expect(r.reason).toMatch(/keeps only recent history/)
  })

  it("an archival node's miss IS a finding, whatever it is called", async () => {
    // Deliberately NOT the well-known hostname: identity is established by
    // asking the node, not by matching a string.
    vi.stubEnv("NEAR_RPC_URLS", "https://my-own-archival-provider.test")
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}")
      if (body.method === "EXPERIMENTAL_tx_status") return err("UNKNOWN_TRANSACTION")
      if (body.method === "block") return ok({ header: { height: 1 } })
      return json({}, 500)
    }))
    const r = await nearRpc("EXPERIMENTAL_tx_status", ["h", "a.near"])
    expect(r.kind).toBe("missing")
  })

  it("fails closed when the node cannot be asked whether it prunes", async () => {
    vi.stubEnv("NEAR_RPC_URLS", "https://silent.test")
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: { body?: string }) => {
      const body = JSON.parse(init?.body ?? "{}")
      if (body.method === "EXPERIMENTAL_tx_status") return err("UNKNOWN_TRANSACTION")
      throw new Error("no answer")
    }))
    expect((await nearRpc("EXPERIMENTAL_tx_status", ["h", "a.near"])).kind).toBe("unavailable")
  })
})

describe("an account that does not exist is a finding, not a failure", () => {
  /**
   * Throwing Unavailable for a nonexistent account produced a contradiction:
   * the tool arm catches it and tells the model "do NOT say the account does
   * not exist", while the reason string says exactly that. The model gets both
   * halves and one is wrong.
   */
  it("is its own error class, so a caller cannot conflate the two", async () => {
    const { NearAccountNotFoundError, NearLookupUnavailableError } = await import("./lookup")
    const notFound = new NearAccountNotFoundError("nobody.near")
    expect(notFound).not.toBeInstanceOf(NearLookupUnavailableError)
    expect(notFound.accountId).toBe("nobody.near")
  })
})
