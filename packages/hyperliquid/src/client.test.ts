import { describe, it, expect, vi, afterEach } from "vitest"
import { getHyperliquidAccount, getHyperliquidFills, getHyperliquidOrders } from "./client"

const USER = "0x31ca8395cf837de08b24da3f660e77761dfb974b"
const res = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, headers: new Headers() }) as unknown as Response

/** Real shapes, captured from mainnet on 2026-09-08. */
const PERP = {
  marginSummary: { accountValue: "3061772.1220089998", totalMarginUsed: "208708.598201" },
  withdrawable: "2640986.78517",
  assetPositions: [
    { position: { coin: "BTC", szi: "-0.42673", entryPx: "78857.7", positionValue: "33362.17813", unrealizedPnl: "288.783003", liquidationPx: "7079722.66", leverage: { type: "cross", value: 20 } } },
    { position: { coin: "ATOM", szi: "3343.66", entryPx: "1.6531", unrealizedPnl: "208.40828", leverage: { type: "cross", value: 20 } } },
  ],
}
const SPOT = { balances: [{ coin: "USDC", total: "4.8765" }] }

function endpoint(map: Record<string, unknown>) {
  return vi.fn(async (_u: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { type?: string }
    const v = map[body.type ?? ""]
    return v === "DOWN" ? res(503, {}) : res(200, v ?? {})
  })
}

afterEach(() => vi.unstubAllGlobals())

describe("reads distinguish three outcomes", () => {
  it("an unreachable exchange is unavailable, never an empty account", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => res(503, {})))
    const r = await getHyperliquidAccount(USER)
    expect(r.kind).toBe("unavailable")
    expect(r.kind === "unavailable" && r.reason).toMatch(/503/)
  })

  it("a network that never answers is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up") }))
    expect((await getHyperliquidOrders(USER)).kind).toBe("unavailable")
  })

  it("a malformed address is refused before any request goes out", async () => {
    const f = vi.fn()
    vi.stubGlobal("fetch", f)
    expect((await getHyperliquidAccount("nope")).kind).toBe("unavailable")
    expect(f).not.toHaveBeenCalled()
  })

  // The exchange answers for ANY address, so an empty list is a real answer.
  it("an empty order list is an answer, not a failure", async () => {
    vi.stubGlobal("fetch", endpoint({ historicalOrders: [] }))
    const r = await getHyperliquidOrders(USER)
    expect(r.kind).toBe("ok")
    expect(r.kind === "ok" && r.value).toEqual([])
  })
})

describe("positions", () => {
  it("reads a short from the sign of the size, and never inverts it", async () => {
    vi.stubGlobal("fetch", endpoint({ clearinghouseState: PERP, spotClearinghouseState: SPOT }))
    const r = await getHyperliquidAccount(USER)
    expect(r.kind).toBe("ok")
    if (r.kind !== "ok") return
    const btc = r.value.positions.find(p => p.coin === "BTC")
    const atom = r.value.positions.find(p => p.coin === "ATOM")
    expect(btc?.direction).toBe("short")
    expect(atom?.direction).toBe("long")
  })

  // Hyperliquid returns decimal strings already in human units, unlike Decibel
  // on Aptos which returns fixed-point integers. Introducing arithmetic here
  // would be inventing precision the exchange never gave.
  it("passes every figure through untouched", async () => {
    vi.stubGlobal("fetch", endpoint({ clearinghouseState: PERP, spotClearinghouseState: SPOT }))
    const r = await getHyperliquidAccount(USER)
    if (r.kind !== "ok") throw new Error("expected ok")
    expect(r.value.accountValue).toBe("3061772.1220089998")
    expect(r.value.positions[0]?.entryPrice).toBe("78857.7")
    expect(r.value.positions[0]?.size).toBe("-0.42673")
    expect(r.value.withdrawable).toBe("2640986.78517")
  })

  it("reports a field the exchange omitted as null, never zero", async () => {
    vi.stubGlobal("fetch", endpoint({ clearinghouseState: PERP, spotClearinghouseState: SPOT }))
    const r = await getHyperliquidAccount(USER)
    if (r.kind !== "ok") throw new Error("expected ok")
    expect(r.value.positions.find(p => p.coin === "ATOM")?.liquidationPrice).toBeNull()
  })

  it("separates never traded from an account that holds spot only", async () => {
    vi.stubGlobal("fetch", endpoint({
      clearinghouseState: { marginSummary: { accountValue: "0.0" }, assetPositions: [] },
      spotClearinghouseState: SPOT,
    }))
    const held = await getHyperliquidAccount(USER)
    expect(held.kind === "ok" && held.value.neverTraded).toBe(false)

    vi.stubGlobal("fetch", endpoint({
      clearinghouseState: { marginSummary: { accountValue: "0.0" }, assetPositions: [] },
      spotClearinghouseState: { balances: [] },
    }))
    const fresh = await getHyperliquidAccount(USER)
    expect(fresh.kind === "ok" && fresh.value.neverTraded).toBe(true)
  })
})

describe("orders carry the reason the exchange gave", () => {
  const ORDERS = [
    { order: { coin: "SUPER", side: "B", sz: "204.0", origSz: "204.0", limitPx: "0.12333", oid: 1, tif: "Ioc", orderType: "Limit", timestamp: Date.now() - 69 * 60_000, reduceOnly: false }, status: "iocCancelRejected", statusTimestamp: Date.now() },
    { order: { coin: "BTC", side: "A", sz: "1.0", origSz: "1.0", limitPx: "80000", oid: 2, tif: "Gtc", orderType: "Limit", timestamp: Date.now() }, status: "open", statusTimestamp: Date.now() },
  ]

  it("explains a rejection and leaves a resting order alone", async () => {
    vi.stubGlobal("fetch", endpoint({ historicalOrders: ORDERS }))
    const r = await getHyperliquidOrders(USER)
    if (r.kind !== "ok") throw new Error("expected ok")
    expect(r.value[0]?.statusKind).toBe("rejected")
    expect(r.value[0]?.reason).toMatch(/immediate-or-cancel/)
    expect(r.value[0]?.side).toBe("buy")
    expect(r.value[1]?.statusKind).toBe("normal")
    expect(r.value[1]?.side).toBe("sell")
  })

  // Hyperliquid stamps in MILLISECONDS. Reading them as seconds renders 1970.
  it("computes elapsed time in code, from milliseconds", async () => {
    vi.stubGlobal("fetch", endpoint({ historicalOrders: ORDERS }))
    const r = await getHyperliquidOrders(USER)
    expect(r.kind === "ok" && r.value[0]?.age).toBe("1 hour 9 minutes ago")
  })

  it("keeps the exchange's own status string verbatim", async () => {
    vi.stubGlobal("fetch", endpoint({ historicalOrders: ORDERS }))
    const r = await getHyperliquidOrders(USER)
    expect(r.kind === "ok" && r.value[0]?.status).toBe("iocCancelRejected")
  })
})

describe("fills", () => {
  it("reads a fill with its own direction and pnl", async () => {
    vi.stubGlobal("fetch", endpoint({
      userFills: [{ coin: "ALGO", px: "0.097947", sz: "158.0", side: "A", time: Date.now(), dir: "Close Long", closedPnl: "0.114708", fee: "0.0", hash: "0x" + "a".repeat(64) }],
    }))
    const r = await getHyperliquidFills(USER)
    if (r.kind !== "ok") throw new Error("expected ok")
    expect(r.value[0]?.direction).toBe("Close Long")
    expect(r.value[0]?.closedPnl).toBe("0.114708")
    expect(r.value[0]?.side).toBe("sell")
  })
})
