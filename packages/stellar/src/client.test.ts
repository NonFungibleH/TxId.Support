import { describe, it, expect, vi, afterEach } from "vitest"
import { getStellarBalance, getStellarRecentTransactions, getStellarTransaction } from "./client"

const HASH = "b".repeat(64)
const ACCOUNT = "GCY7CS6PUPRVVSJO7UWV6DOHXXDGTGIHIE6F3VCBPNDXZFCOK57Y2DNG"
const PP_SEND = "AAAAAAAAAGT/////AAAAAQAAAAAAAAAN////9AAAAAA="

const res = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: new Headers() }) as unknown as Response

afterEach(() => vi.unstubAllGlobals())

describe("Stellar reads distinguish three outcomes", () => {
  it("a 404 from Horizon is not_found: it looked and has no record", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(404, { title: "Resource Missing" })))
    expect((await getStellarTransaction(HASH)).kind).toBe("not_found")
  })

  it("a 503 is unavailable, never not_found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(503, {})))
    const r = await getStellarTransaction(HASH)
    expect(r.kind).toBe("unavailable")
    expect(r.kind === "unavailable" && r.reason).toMatch(/503/)
  })

  it("a network that never answers is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up") }))
    expect((await getStellarTransaction(HASH)).kind).toBe("unavailable")
  })

  it("a malformed hash is refused before any request goes out", async () => {
    const f = vi.fn()
    vi.stubGlobal("fetch", f)
    expect((await getStellarTransaction("nope")).kind).toBe("unavailable")
    expect(f).not.toHaveBeenCalled()
  })
})

describe("a failed transaction comes back explained", () => {
  it("decodes the result and sets a reason", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, {
      hash: HASH, ledger: 64329573, created_at: new Date(Date.now() - 69 * 60_000).toISOString(),
      source_account: ACCOUNT, successful: false, fee_charged: "100", operation_count: 1, result_xdr: PP_SEND,
    })))
    const r = await getStellarTransaction(HASH)
    expect(r.kind).toBe("ok")
    if (r.kind !== "ok") return
    expect(r.value.status).toBe("failed")
    expect(r.value.decodedResult?.failing?.name).toBe("PATH_PAYMENT_STRICT_SEND_UNDER_DESTMIN")
    expect(r.value.reason).toMatch(/slippage protection/)
    expect(r.value.feeXlm).toBe("0.00001 XLM")
    // Elapsed time is computed in code, never left to the model.
    expect(r.value.age).toBe("1 hour 9 minutes ago")
    // The raw XDR travels with it so a reviewer can re-decode independently.
    expect(r.value.resultXdr).toBe(PP_SEND)
  })

  it("carries no failure fields on a success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, {
      hash: HASH, ledger: 1, created_at: new Date().toISOString(), source_account: ACCOUNT,
      successful: true, fee_charged: "100", operation_count: 1,
    })))
    const r = await getStellarTransaction(HASH)
    expect(r.kind === "ok" && r.value.status).toBe("success")
    expect(r.kind === "ok" && r.value.reason).toBeUndefined()
    expect(r.kind === "ok" && r.value.decodedResult).toBeUndefined()
  })
})

describe("balances carry the reserve, because a visible balance is not a spendable one", () => {
  it("computes the reserve from the subentry count", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, {
      subentry_count: 24,
      balances: [
        { asset_type: "credit_alphanum4", asset_code: "USDC", asset_issuer: "GA5Z", balance: "10.5", limit: "1000", is_authorized: true },
        { asset_type: "native", balance: "2341.6940470" },
      ],
    })))
    const r = await getStellarBalance(ACCOUNT)
    expect(r.kind).toBe("ok")
    if (r.kind !== "ok") return
    expect(r.value.xlm).toBe("2341.6940470")
    // 1 base + 0.5 per subentry.
    expect(r.value.reserveXlm).toBe("13.0")
    expect(r.value.balances).toHaveLength(2)
    expect(r.value.balances[0]?.limit).toBe("1000")
  })

  // NOT COMPUTED must never render as zero: telling somebody their reserve is
  // nothing is telling them their whole balance is spendable.
  it("reports the reserve as null when the subentry count was absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, { balances: [{ asset_type: "native", balance: "5" }] })))
    const r = await getStellarBalance(ACCOUNT)
    expect(r.kind === "ok" && r.value.reserveXlm).toBeNull()
    expect(r.kind === "ok" && r.value.subentryCount).toBeNull()
  })
})

describe("history", () => {
  // Horizon omits failed transactions by DEFAULT. Without include_failed the
  // one product built to explain failures would never see one.
  it("asks Horizon for failed transactions too", async () => {
    const f = vi.fn(async () => res(200, { _embedded: { records: [] } }))
    vi.stubGlobal("fetch", f)
    await getStellarRecentTransactions(ACCOUNT, 5)
    expect(String(f.mock.calls[0]?.[0])).toContain("include_failed=true")
  })

  it("an empty list is an answer, not a failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, { _embedded: { records: [] } })))
    const r = await getStellarRecentTransactions(ACCOUNT)
    expect(r.kind).toBe("ok")
    expect(r.kind === "ok" && r.value).toEqual([])
  })

  it("explains every failure in the list", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(200, {
      _embedded: { records: [
        { hash: HASH, successful: false, fee_charged: "100", operation_count: 1, result_xdr: PP_SEND, created_at: new Date().toISOString() },
      ] },
    })))
    const r = await getStellarRecentTransactions(ACCOUNT)
    expect(r.kind === "ok" && r.value[0]?.reason).toMatch(/slippage protection/)
  })
})
