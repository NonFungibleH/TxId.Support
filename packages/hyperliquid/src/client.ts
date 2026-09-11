import { relativeAgeFromEpoch } from "@txid/shared"
import { info } from "./rpc"
import { explainStatus } from "./statuses"
import type {
  HyperliquidAccount, HyperliquidFill, HyperliquidLookup, HyperliquidOrder, HyperliquidPosition,
} from "./types"

/** HyperCore shares HyperEVM's address space, so addresses are ordinary EVM ones. */
export const isHyperliquidAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a.trim())

const str = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null)
/** Hyperliquid stamps in MILLISECONDS. Reading them as seconds renders 1970. */
const stamp = (v: unknown): { at: string | null; age: string | null } => {
  const n = typeof v === "number" ? v : Number(v)
  if (!Number.isFinite(n) || n <= 0) return { at: null, age: null }
  return { at: new Date(n).toISOString(), age: relativeAgeFromEpoch(n, "ms") }
}

/**
 * NO SCALING ANYWHERE IN THIS FILE, and that is verified rather than assumed.
 *
 * Decibel on Aptos returns fixed-point integers with no units, and the model
 * invented a scale and stated a confidently wrong price. Hyperliquid does not:
 * `entryPx` comes back as "78857.7" and `szi` as "-0.42673", already in human
 * units as decimal strings. So these are passed through UNTOUCHED. Introducing
 * arithmetic here would be inventing precision the exchange did not give.
 */
export async function getHyperliquidAccount(address: string): Promise<HyperliquidLookup<HyperliquidAccount>> {
  const a = address.trim()
  if (!isHyperliquidAddress(a)) return { kind: "unavailable", reason: "that is not a Hyperliquid address" }

  const [perp, spot] = await Promise.all([
    info({ type: "clearinghouseState", user: a }),
    info({ type: "spotClearinghouseState", user: a }),
  ])
  if (!perp.ok) return { kind: "unavailable", reason: perp.reason }

  const p = perp.result as {
    marginSummary?: { accountValue?: string; totalMarginUsed?: string }
    withdrawable?: string
    assetPositions?: { position?: Record<string, unknown> }[]
  } | null
  if (!p || typeof p !== "object") return { kind: "unavailable", reason: "unexpected response shape" }

  const positions: HyperliquidPosition[] = []
  for (const row of p.assetPositions ?? []) {
    const q = row?.position
    if (!q) continue
    const size = str(q["szi"]) ?? "0"
    const lev = q["leverage"] as { value?: number; type?: string } | undefined
    positions.push({
      coin: str(q["coin"]) ?? "?",
      size,
      // A negative size is a SHORT. Getting this backwards tells a user their
      // position is the opposite of what it is.
      direction: size.trim().startsWith("-") ? "short" : "long",
      entryPrice: str(q["entryPx"]),
      positionValue: str(q["positionValue"]),
      unrealizedPnl: str(q["unrealizedPnl"]),
      liquidationPrice: str(q["liquidationPx"]),
      leverage: lev?.value !== undefined ? `${lev.value}x ${lev.type ?? ""}`.trim() : null,
    })
  }

  // The two legs fail independently, and only the perp one was ever guarded.
  // A spot outage turned into `[]`, which is indistinguishable from an account
  // holding no spot, and then fed `neverTraded`.
  const spotUnavailable = !spot.ok
  const spotRows = spot.ok
    ? ((spot.result as { balances?: { coin?: string; total?: string }[] } | null)?.balances ?? [])
    : []

  const accountValue = str(p.marginSummary?.accountValue)
  // The exchange answers for ANY address: an account that has never traded
  // comes back zeroed rather than missing. That is a real answer and the same
  // fact, so it is reported as one rather than as an absence.
  //
  // It is only a real answer when BOTH legs were read. With spot unread there
  // is no evidence about spot, so the claim cannot be made.
  const nothingOnPerps = (accountValue === null || Number(accountValue) === 0) && positions.length === 0
  const neverTraded = !spotUnavailable && nothingOnPerps && spotRows.length === 0

  // Perps empty AND spot unread is nothing measured at all. Returning an
  // account here would be handing back a shape with no evidence in it.
  if (spotUnavailable && nothingOnPerps) {
    return { kind: "unavailable", reason: spot.ok ? "the spot balance could not be read" : spot.reason }
  }

  return {
    kind: "ok",
    value: {
      address: a,
      accountValue,
      withdrawable: str(p.withdrawable),
      totalMarginUsed: str(p.marginSummary?.totalMarginUsed),
      positions,
      spot: spotRows.filter(b => str(b.total) !== null).map(b => ({ coin: b.coin ?? "?", total: b.total! })),
      spotUnavailable,
      neverTraded,
    },
  }
}

/**
 * Recent orders, WITH THE REJECTED ONES, which is the entire point.
 *
 * `historicalOrders` is the only read here that answers "why did nothing
 * happen", because a rejected order leaves no fill, no transaction and no
 * balance change. It is invisible everywhere else.
 */
export async function getHyperliquidOrders(address: string, limit = 25): Promise<HyperliquidLookup<HyperliquidOrder[]>> {
  const a = address.trim()
  if (!isHyperliquidAddress(a)) return { kind: "unavailable", reason: "that is not a Hyperliquid address" }

  const out = await info({ type: "historicalOrders", user: a })
  if (!out.ok) return { kind: "unavailable", reason: out.reason }
  const rows = out.result
  // An empty array IS an answer: the exchange looked and this address has no
  // order history. Only the tri-state can keep that apart from an outage.
  if (!Array.isArray(rows)) return { kind: "unavailable", reason: "unexpected response shape" }

  const n = Math.min(Math.max(limit, 1), 100)
  const orders: HyperliquidOrder[] = []
  for (const row of rows.slice(0, n)) {
    const o = (row as { order?: Record<string, unknown> }).order ?? {}
    const status = str((row as { status?: unknown }).status) ?? "unknown"
    const meaning = explainStatus(status)
    const placed = stamp(o["timestamp"])
    const at = stamp((row as { statusTimestamp?: unknown }).statusTimestamp)
    orders.push({
      coin: str(o["coin"]) ?? "?",
      // Hyperliquid uses "B" and "A" for the two sides of the book.
      side: str(o["side"]) === "B" ? "buy" : "sell",
      size: str(o["sz"]) ?? "0",
      originalSize: str(o["origSz"]) ?? str(o["sz"]) ?? "0",
      limitPrice: str(o["limitPx"]),
      orderType: str(o["orderType"]),
      timeInForce: str(o["tif"]),
      reduceOnly: o["reduceOnly"] === true,
      orderId: typeof o["oid"] === "number" ? o["oid"] : null,
      placedAt: placed.at,
      age: placed.age,
      status,
      statusKind: meaning.kind,
      reason: meaning.reason,
      statusAt: at.at,
    })
  }
  return { kind: "ok", value: orders }
}

export async function getHyperliquidFills(address: string, limit = 25): Promise<HyperliquidLookup<HyperliquidFill[]>> {
  const a = address.trim()
  if (!isHyperliquidAddress(a)) return { kind: "unavailable", reason: "that is not a Hyperliquid address" }

  const out = await info({ type: "userFills", user: a })
  if (!out.ok) return { kind: "unavailable", reason: out.reason }
  const rows = out.result
  if (!Array.isArray(rows)) return { kind: "unavailable", reason: "unexpected response shape" }

  const n = Math.min(Math.max(limit, 1), 100)
  return {
    kind: "ok",
    value: rows.slice(0, n).map(r => {
      const f = r as Record<string, unknown>
      const t = stamp(f["time"])
      return {
        coin: str(f["coin"]) ?? "?",
        side: str(f["side"]) === "B" ? "buy" : "sell",
        price: str(f["px"]) ?? "0",
        size: str(f["sz"]) ?? "0",
        direction: str(f["dir"]),
        closedPnl: str(f["closedPnl"]),
        fee: str(f["fee"]),
        hash: str(f["hash"]),
        filledAt: t.at,
        age: t.age,
      }
    }),
  }
}
