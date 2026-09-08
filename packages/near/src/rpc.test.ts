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
    if (r.kind === "unavailable") expect(r.reason).toMatch(/keep only recent history/)
  })

  it("reports a miss as a finding once an archival node is in the list", async () => {
    vi.stubEnv("NEAR_RPC_URLS", "https://archival-rpc.mainnet.near.org")
    vi.stubGlobal("fetch", vi.fn(async () => err("UNKNOWN_TRANSACTION")))
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
