import { describe, it, expect, vi, afterEach } from "vitest"
import { adapterFor, describeOwnFills } from "./protocols"

/**
 * The reported bug, pinned.
 *
 * A real APT/USD close of 16.5 APT at $0.6026, losing about five cents, was
 * reported to the trader as "1.65 MEGA at 602.6, a loss of -49,500 in base
 * units", plus a description of the counterparty's position as if it were
 * theirs. Wrong market, size out by 10x, price out by 1000x, PnL unscaled, and
 * another trader's position leaked.
 *
 * One cause: get_recent_transactions handed the model raw `events`, which are
 * fixed-point integers with no market name and no scale, so it invented all of
 * it. MEGA/USD is a real Decibel market, which is why the answer read as
 * confident rather than broken.
 */
const DECIBEL = "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06"
const SUB = "0x54612f3b091c39fd1406989dc080c4b68747828b816b5f0b9ea877b35f4b72a1"
const WALLET = "0x7f30c83581449d802e25b182bbdc96c90e47add4466dd3f6256deabdef48ff0b"
const COUNTERPARTY = "0xd6b4dccb59e8c9bd451e2e7d935039bef1e6de51ffbab2f77b1e9de73996b301"

// The market objects and their real size decimals: APT 5, MEGA 4. The 10x size
// error came from using a flat 1e6 instead of the market's own 1e5.
const APT_MARKET = "0xda8615922bac85a53811e845ce39110713be6d80366f4477d5427002ac0162e3"
const adapter = adapterFor([{ address: DECIBEL, chain: "aptos" }])!

/** Verbatim from mainnet version 7063524580. */
const tradeEvent = (account: string, extra: Record<string, unknown> = {}) => ({
  type: `${DECIBEL}::perp_market::TradeEvent`,
  data: {
    __variant__: "V2",
    account,
    action: { __variant__: "CloseLong" },
    counter_party_account: COUNTERPARTY,
    fee: "4474",
    is_taker: true,
    market: { inner: APT_MARKET },
    price: "602600",
    realized_pnl: "-49500",
    size: "1650000",
    ...extra,
  },
})

/** list_markets then market_name / market_sz_decimals per object. */
function decibelViews() {
  return vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { function?: string; arguments?: unknown[] }
    const fn = (body.function ?? "").split("::").pop()
    const reply = (v: unknown) => ({ ok: true, status: 200, json: async () => [v], headers: new Headers() }) as unknown as Response
    if (fn === "list_markets") return ({ ok: true, status: 200, json: async () => [[APT_MARKET]], headers: new Headers() }) as unknown as Response
    if (fn === "market_name") return reply("APT/USD")
    if (fn === "market_sz_decimals") return reply(5)
    return ({ ok: false, status: 400, json: async () => ({ message: "no" }), headers: new Headers() }) as unknown as Response
  })
}

afterEach(() => vi.unstubAllGlobals())

describe("describeOwnFills", () => {
  it("names the market from the fill event, not MEGA", async () => {
    vi.stubGlobal("fetch", decibelViews())
    const out = await describeOwnFills(adapter, [tradeEvent(SUB)], [WALLET, SUB])
    expect(out!.fills[0]!.market).toBe("APT/USD")
  })

  it("scales the size by the market's own decimals, not a flat 1e6", async () => {
    vi.stubGlobal("fetch", decibelViews())
    const out = await describeOwnFills(adapter, [tradeEvent(SUB)], [WALLET, SUB])
    expect(out!.fills[0]!.size, "1650000 / 1e5, not / 1e6").toBe("16.5")
  })

  it("scales price, fee and realized PnL at 1e6", async () => {
    vi.stubGlobal("fetch", decibelViews())
    const f = (await describeOwnFills(adapter, [tradeEvent(SUB)], [WALLET, SUB]))!.fills[0]!
    expect(f.price).toBe("$0.6026")
    expect(f.fee).toBe("$0.004474")
    expect(f.realizedPnl).toBe("-$0.0495")
    expect(f.notional).toBe("$9.94")
  })

  it("reads the action from the event rather than inferring it", async () => {
    vi.stubGlobal("fetch", decibelViews())
    const out = await describeOwnFills(adapter, [tradeEvent(SUB, { action: { __variant__: "OpenShort" } })], [SUB])
    expect(out!.fills[0]!.action).toBe("opened a short")
  })

  it("EXCLUDES the counterparty's fill, which was being described as the user's", async () => {
    vi.stubGlobal("fetch", decibelViews())
    const events = [tradeEvent(SUB), tradeEvent(COUNTERPARTY, { fee: "0", realized_pnl: "13200" })]
    const out = await describeOwnFills(adapter, events, [WALLET, SUB])
    expect(out!.fills).toHaveLength(1)
    expect(JSON.stringify(out!.fills)).not.toContain("13,200")
  })

  it("returns null when none of the fills are the user's", async () => {
    vi.stubGlobal("fetch", decibelViews())
    expect(await describeOwnFills(adapter, [tradeEvent(COUNTERPARTY)], [WALLET, SUB])).toBeNull()
  })

  it("refuses to state a size when the market's decimals could not be read", async () => {
    // Better a stated gap than a size out by orders of magnitude. Uses its own
    // market object because getProtocolMarkets caches per adapter, so a market
    // another test already resolved would come back with its decimals intact.
    const OTHER = "0x" + "7".repeat(64)
    vi.stubGlobal("fetch", vi.fn(async (_u: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { function?: string }
      const fn = (body.function ?? "").split("::").pop()
      const reply = (v: unknown) => ({ ok: true, status: 200, json: async () => [v], headers: new Headers() }) as unknown as Response
      if (fn === "list_markets") return ({ ok: true, status: 200, json: async () => [[APT_MARKET, OTHER]], headers: new Headers() }) as unknown as Response
      if (fn === "market_name") return reply("APT/USD")
      return ({ ok: false, status: 503, json: async () => ({}), headers: new Headers() }) as unknown as Response
    }))
    const ev = tradeEvent(SUB, { market: { inner: OTHER } })
    const out = await describeOwnFills(adapter, [ev], [SUB])
    // Unknown market, and crucially no invented size.
    expect(out!.fills[0]!.size === null || /could not be read/.test(String(out!.fills[0]!.size))).toBe(true)
  })

  it("tells the model not to scale raw events itself, and not to describe other accounts", async () => {
    vi.stubGlobal("fetch", decibelViews())
    const out = await describeOwnFills(adapter, [tradeEvent(SUB)], [SUB])
    expect(out!.fillsNote).toMatch(/do NOT scale a raw integer yourself/i)
    expect(out!.fillsNote).toMatch(/COUNTERPARTY/)
    expect(out!.fillsNote).toMatch(/never take the market from the transaction's arguments/i)
  })

  it("does nothing without events or accounts", async () => {
    expect(await describeOwnFills(adapter, [], [SUB])).toBeNull()
    expect(await describeOwnFills(adapter, [tradeEvent(SUB)], [])).toBeNull()
  })
})
