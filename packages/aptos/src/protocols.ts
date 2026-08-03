import { normalizeAptosAddress } from "./address"
import { viewFunctionResult } from "./fullnode"

/**
 * Protocol-shape adapters, keyed by the protocol's package address (the same
 * keying PROTOCOL_ERRMAPS uses).
 *
 * WHY THIS EXISTS: on Aptos a protocol's user state usually does NOT live on
 * the user's wallet. Decibel, for example, holds every trader's collateral and
 * positions in a per-user `Subaccount` OBJECT, addressed separately from the
 * wallet. Reading the wallet balance and reporting it as the trading balance is
 * not a missing feature, it is a WRONG ANSWER: a trader with $50k of posted
 * collateral would be told they hold whatever dust sits in their Petra wallet.
 *
 * Each adapter therefore declares how to get from a wallet to the protocol's
 * own account, and which views describe that account.
 */

const DECIBEL = "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06"

export interface ProtocolAdapter {
  name: string
  /** What the protocol calls its per-user account, for use in prose. */
  accountLabel: string
  /** view(wallet) -> account address. */
  resolveAccountFn: string
  /** views taking the resolved account address. */
  accountViews: { label: string; fn: string }[]
  /** view() -> list of market objects, when the protocol has named markets. */
  listMarketsFn?: string
  /** view(marketObject) -> human name. */
  marketNameFn?: string
  /** view(marketObject) -> decimals for that market's size field. */
  marketSizeDecimalsFn?: string
  /**
   * Reads that only make sense for a market the trader actually holds, so they
   * stay bounded by the size of the book rather than the venue's market count.
   * These answer the questions a trader actually asks ("am I up or down?",
   * "am I about to be liquidated?", "why was my order rejected?"), none of
   * which the account-level views can reach on their own.
   */
  perMarket?: {
    /** view(marketObject) -> current price, same 1e6 scale as entry price. */
    oraclePriceFn?: string
    /** view(account, marketObject) -> bool. */
    liquidatableFn?: string
    /** view(marketObject) -> value. Order-constraint parameters. */
    paramFns?: { label: string; fn: string }[]
  }
  /** Explains the account model, injected verbatim into the tool result. */
  note: string
  /**
   * Move views return fixed-point integers with no units attached, so a raw
   * result reads as a wildly wrong number: Decibel reports a $322.76 TSLA entry
   * as 322760000. Left to interpret those alone the model invents a scale and
   * states a confidently wrong price, which is worse than declining. This turns
   * the raw values into figures already in dollars and units.
   */
  humanize?: (
    values: Record<string, unknown>,
    market: (object: string) => ProtocolMarket | null,
    live: (object: string) => MarketLive | null,
  ) => Record<string, unknown>
}

/** Live, per-market reads for the markets a trader currently holds. */
export interface MarketLive {
  oraclePrice?: number
  liquidatable?: boolean
  params?: Record<string, unknown>
}

const num = (v: unknown): number | null => {
  const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}
// Two decimal places is wrong for the small-cap markets Decibel lists: a
// $0.0371 entry rounds to "$0.04", which a trader reads as a different price.
// Scale the precision to the magnitude, and keep the minus outside the sign.
const usd = (v: unknown, scale: number): string | null => {
  const n = num(v)
  if (n === null) return null
  const x = n / scale
  const abs = Math.abs(x)
  const dp = abs === 0 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6
  const body = abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: dp })
  return `${x < 0 ? "-" : ""}$${body}`
}

// Decibel quotes prices, sizes and USD amounts in 1e6 fixed point. Leverage is
// a plain integer. Verified against live mainnet positions: TSLA/USD entry
// 322760000 = $322.76, GOLD/USD 4038600000 = $4,038.60.
const DECIBEL_SCALE = 1_000_000

function humanizeDecibel(
  values: Record<string, unknown>,
  market: (object: string) => ProtocolMarket | null,
  live: (object: string) => MarketLive | null,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}

  const coll = usd(values.crossCollateralValue, DECIBEL_SCALE)
  if (coll) out.crossCollateral = coll
  const nav = usd(values.netAssetValue, DECIBEL_SCALE)
  if (nav) out.netAssetValue = nav

  const raw = values.positions
  const list = Array.isArray(raw) ? raw : []
  if (list.length === 0 && Array.isArray(raw)) out.positions = "no open positions"
  if (list.length > 0) {
    out.positions = list.map(p => {
      const pos = (p ?? {}) as Record<string, unknown>
      const object = unwrapObject((pos as { market?: unknown }).market)
      const info = object ? market(object) : null
      const now = object ? live(object) : null
      // Size decimals are set PER MARKET (BTC 8, TSLA 7, MEGA 4), so a flat
      // scale misreports size, and notional with it, by orders of magnitude.
      // Without the market's own figure, do not guess: say so instead.
      const sizeScale = info?.szDecimals != null ? 10 ** info.szDecimals : null
      const size = num(pos.size)
      const px = num(pos.avg_acquire_entry_px)
      const notional = num(pos.entry_px_times_size_sum)
      const unknownScale = "unknown: this market's size decimals could not be read, so the size cannot be stated"
      return {
        market: info?.name || object || "unknown market",
        side: pos.is_long === true ? "long" : pos.is_long === false ? "short" : "unknown",
        margin: pos.is_isolated === true ? "isolated" : "cross",
        size: size === null ? null : sizeScale === null ? unknownScale : size / sizeScale,
        entryPrice: usd(px, DECIBEL_SCALE),
        notionalAtEntry:
          notional === null ? null
          : sizeScale === null ? unknownScale
          : usd(notional, DECIBEL_SCALE * sizeScale),
        leverage: pos.user_leverage != null ? `${pos.user_leverage}x` : null,
        unrealisedFunding: usd(pos.unrealized_funding_amount_before_last_update, DECIBEL_SCALE),
        ...pnlOf(pos, now, size, px, sizeScale),
        // Straight from the contract's own liquidation check, not a threshold
        // guessed here.
        liquidatable: now?.liquidatable ?? null,
        orderConstraints: orderConstraintsOf(now, info),
      }
    })
  }

  const status = values.crossPositionStatus
  if (status && typeof status === "object") {
    const s = status as Record<string, unknown>
    const equity = num(s.account_equity)
    const threshold = num(s.liquidation_margin)
    out.marginHealth = {
      accountEquity: usd(s.account_equity, DECIBEL_SCALE),
      liquidationThreshold: usd(s.liquidation_margin, DECIBEL_SCALE),
      bufferAboveLiquidation:
        equity === null || threshold === null ? null : usd(equity - threshold, DECIBEL_SCALE),
      totalNotional: usd(s.total_notional_value, DECIBEL_SCALE),
      freeCollateral: usd(s.margin_for_free_collateral, DECIBEL_SCALE),
      note: "Cross-margin only. Liquidation becomes possible when accountEquity falls to liquidationThreshold, so bufferAboveLiquidation is the cushion left. State these figures; do not invent a risk rating or a percentage the contract did not give you.",
    }
  }

  out.note =
    "These are the same figures as the raw values above, converted into dollars and units. QUOTE THESE, never the raw integers. Prices are 1e6 fixed point; SIZE decimals are set per market (BTC 8, TSLA 7, MEGA 4), which is why size must come from here rather than from the raw value. notionalAtEntry is size multiplied by entry price, so it is the value at entry, NOT the current value: do not present it as a position's worth today. unrealisedFunding is only the amount accrued before the last funding update, so it is not the position's full funding cost."
  return out
}

// Unrealised PnL from the live oracle price against the recorded entry. Only
// computed when the size scale is known, since a wrong scale would scale the
// PnL with it.
function pnlOf(
  pos: Record<string, unknown>,
  now: MarketLive | null,
  size: number | null,
  entryRaw: number | null,
  sizeScale: number | null,
): Record<string, unknown> {
  const price = now?.oraclePrice
  if (price == null || size === null || entryRaw === null || sizeScale === null) return {}
  const units = size / sizeScale
  const entry = entryRaw / DECIBEL_SCALE
  const mark = price / DECIBEL_SCALE
  const direction = pos.is_long === true ? 1 : pos.is_long === false ? -1 : 0
  if (direction === 0) return { currentPrice: usd(price, DECIBEL_SCALE) }
  const pnl = (mark - entry) * units * direction
  return {
    currentPrice: usd(price, DECIBEL_SCALE),
    unrealisedPnL: usd(pnl * DECIBEL_SCALE, DECIBEL_SCALE),
    pnlNote: "Price move only, from the oracle price against the entry price. It excludes funding and fees, so it is not the exact amount realised on close.",
  }
}

// What a rejected order would have breached. Sizes are in the market's own
// units, so they scale with that market's decimals like any other size.
function orderConstraintsOf(
  now: MarketLive | null,
  info: ProtocolMarket | null,
): Record<string, unknown> | null {
  const p = now?.params
  if (!p) return null
  const scale = info?.szDecimals != null ? 10 ** info.szDecimals : null
  const sized = (v: unknown) => {
    const n = num(v)
    return n === null ? null : scale === null ? `${n} (raw)` : n / scale
  }
  return {
    minOrderSize: sized(p.minSize),
    sizeIncrement: sized(p.lotSize),
    maxLeverage: p.maxLeverage != null ? `${p.maxLeverage}x` : null,
    marketOpen: p.isOpen ?? null,
    isolatedOnly: p.isolatedOnly ?? null,
    note: "An order is rejected when it breaches one of these: below minOrderSize, not a multiple of sizeIncrement, above maxLeverage, or placed while marketOpen is false. isolatedOnly true means the market takes isolated margin only, which on its own explains a zero cross-collateral figure.",
  }
}

export const PROTOCOL_ADAPTERS: Record<string, ProtocolAdapter> = {
  [DECIBEL]: {
    name: "Decibel",
    accountLabel: "subaccount",
    resolveAccountFn: `${DECIBEL}::dex_accounts::primary_subaccount`,
    accountViews: [
      // CROSS margin only. Decibel also supports ISOLATED positions, whose
      // collateral is held per market and is NOT counted here, so a zero
      // cross figure does not mean the trader has no funds on the venue.
      { label: "crossCollateralValue", fn: `${DECIBEL}::perp_engine::get_cross_total_collateral_value` },
      { label: "netAssetValue", fn: `${DECIBEL}::perp_engine::get_account_net_asset_value` },
      { label: "positions", fn: `${DECIBEL}::perp_engine::list_positions` },
      { label: "crossPositionStatus", fn: `${DECIBEL}::perp_engine::cross_position_status` },
      // "Have I enabled trading?" is a real support question and Decibel
      // answers it on chain: the app's "Establish connection" step delegates
      // trading to a session key, and these two views expose the result.
      // Without them the bot could only tell the user to go and look at the UI,
      // which is precisely the deflection the prompt forbids.
      { label: "delegatedPermissions", fn: `${DECIBEL}::dex_accounts::view_delegated_permissions` },
      { label: "subaccountActive", fn: `${DECIBEL}::dex_accounts::view_is_subaccount_active` },
    ],
    listMarketsFn: `${DECIBEL}::perp_engine::list_markets`,
    marketNameFn: `${DECIBEL}::perp_engine::market_name`,
    marketSizeDecimalsFn: `${DECIBEL}::perp_engine::market_sz_decimals`,
    perMarket: {
      oraclePriceFn: `${DECIBEL}::perp_engine::get_oracle_price`,
      liquidatableFn: `${DECIBEL}::perp_engine::is_position_liquidatable`,
      paramFns: [
        { label: "minSize", fn: `${DECIBEL}::perp_engine::market_min_size` },
        { label: "lotSize", fn: `${DECIBEL}::perp_engine::market_lot_size` },
        { label: "maxLeverage", fn: `${DECIBEL}::perp_engine::market_max_leverage` },
        { label: "isOpen", fn: `${DECIBEL}::perp_engine::is_market_open` },
        { label: "isolatedOnly", fn: `${DECIBEL}::perp_engine::market_is_isolated_only` },
      ],
    },
    humanize: humanizeDecibel,
    note:
      "On Decibel a trader's collateral and positions live in their subaccount object, NOT in their wallet. The wallet balance is only idle funds that have not been deposited. Always answer position and collateral questions from the subaccount figures below, and never present the wallet balance as the trading balance. IMPORTANT: crossCollateralValue covers CROSS margin only. Decibel also supports ISOLATED positions, whose collateral sits per market and is not included, so a zero cross figure does NOT mean the trader has no funds on the venue. If cross collateral is zero but the user believes they hold a position, say that you can see no cross-margin collateral and ask which market they traded, then read that market's isolated collateral rather than telling them they have nothing. Those reads are PER MARKET, so they cannot be listed above with the account-level views: call get_contract_data with function_name \"perp_engine::get_isolated_position_total_collateral_value\" and args [subaccount, market], and \"perp_engine::is_position_isolated\" with the same args to confirm the position is isolated at all. \"perp_engine::market_is_isolated_only\" takes just the market and tells you whether that venue only supports isolated margin, which explains a zero cross figure on its own. delegatedPermissions and subaccountActive answer \"have I enabled trading?\": Decibel's \"Establish connection\" step delegates trading to a session key so orders can be placed gas-free, and these views report whether that is in place. Note that primary_subaccount returns a DERIVED address, so it resolves even for a wallet that has never used the protocol; when the account views abort, the subaccount object does not exist yet, which means the user has not completed setup rather than that anything is wrong. Say that plainly and tell them the setup step is the connection prompt in the app, but never send them off to read their status from the UI when these views answered it.",
  },
}

/** The adapter for whichever watched contract is a known protocol, if any. */
export function adapterFor(
  watchedContracts: readonly { address: string; chain: string }[],
): ProtocolAdapter | null {
  for (const c of watchedContracts) {
    if (c.chain !== "aptos") continue
    const hit = PROTOCOL_ADAPTERS[normalizeAptosAddress(c.address)]
    if (hit) return hit
  }
  return null
}

export interface ProtocolAccount {
  protocol: string
  accountLabel: string
  /** null when this wallet has no such account yet. */
  accountAddress: string | null
  /** label -> value, or an explanation when that particular view had nothing. */
  values: Record<string, unknown>
  /** The same figures with fixed-point scaling applied. Quote these. */
  readable?: Record<string, unknown>
  note: string
}

function firstValue(data: unknown[]): unknown {
  return Array.isArray(data) && data.length === 1 ? data[0] : data
}

// A Move view that reads a resource aborts when the resource was never
// created. For a perps account that means "nothing here yet", which is an
// ANSWER, not an outage - so it must not be reported as a failed lookup.
function isMissingResource(message: string): boolean {
  return /failed to borrow global resource|resource not found|missing.*resource/i.test(message)
}

/**
 * Wallet -> protocol account ADDRESS alone, without reading any account state.
 * Cheap enough for paths that only need the address (transaction history
 * merging). "none" = the wallet has never created a protocol account, which is
 * an answer; "failed" = the lookup itself failed, which is not.
 */
export async function resolveProtocolAccountAddress(
  adapter: ProtocolAdapter,
  walletAddress: string,
): Promise<{ status: "ok"; address: string } | { status: "none" } | { status: "failed" }> {
  const wallet = normalizeAptosAddress(walletAddress)
  const resolved = await viewFunctionResult(adapter.resolveAccountFn, [], [wallet])
  if (!resolved.ok) return resolved.kind === "aborted" ? { status: "none" } : { status: "failed" }
  const accountAddress = String(firstValue(resolved.data) ?? "")
  return accountAddress.startsWith("0x") ? { status: "ok", address: accountAddress } : { status: "failed" }
}

/**
 * Resolve a wallet to its protocol account and read that account's state.
 * Returns null only when the protocol account itself could not be resolved
 * (i.e. we genuinely do not know), never a fabricated empty portfolio.
 */
export async function getProtocolAccount(
  adapter: ProtocolAdapter,
  walletAddress: string,
): Promise<ProtocolAccount | null> {
  const resolved = await resolveProtocolAccountAddress(adapter, walletAddress)

  if (resolved.status === "none") {
    // A real answer worth giving: this wallet has never created an account
    // with the protocol.
    return {
      protocol: adapter.name,
      accountLabel: adapter.accountLabel,
      accountAddress: null,
      values: {},
      note: `This wallet has no ${adapter.name} ${adapter.accountLabel} yet, so it has never deposited or traded there. ${adapter.note}`,
    }
  }
  if (resolved.status === "failed") return null

  const accountAddress = resolved.address

  const results = await Promise.all(
    adapter.accountViews.map(async v => {
      const r = await viewFunctionResult(v.fn, [], [accountAddress])
      if (r.ok) return [v.label, firstValue(r.data)] as const
      if (r.kind === "aborted" && isMissingResource(r.message)) {
        return [v.label, "none: this account has no such record yet, which means nothing has been opened here"] as const
      }
      if (r.kind === "aborted") return [v.label, `unavailable: ${r.message}`] as const
      return [v.label, "lookup failed: could not reach the Aptos fullnode, this is NOT a statement about the account"] as const
    }),
  )

  const values = Object.fromEntries(results)

  // Name the markets a position points at, so the readable block can say
  // "GOLD/USD" instead of an object address. Cached, and a failure here only
  // costs the names.
  let readable: Record<string, unknown> | undefined
  if (adapter.humanize) {
    const markets = await getProtocolMarkets(adapter).catch(() => null)
    const byObject = new Map((markets ?? []).map(m => [normalizeAptosAddress(m.object), m]))
    const nameOf = (object: string) => byObject.get(normalizeAptosAddress(object)) ?? null

    // Live reads for the markets this trader actually holds. Bounded by the
    // size of the book, so a 60-market venue still costs only a handful of
    // calls, and a failure here degrades the extras rather than the answer.
    const held = heldMarketObjects(values.positions)
    const liveByObject = new Map<string, MarketLive>()
    if (adapter.perMarket && held.length > 0) {
      const { oraclePriceFn, liquidatableFn, paramFns } = adapter.perMarket
      await Promise.all(
        held.slice(0, 8).map(async object => {
          const [price, liq, params] = await Promise.all([
            oraclePriceFn ? viewFunctionResult(oraclePriceFn, [], [object]) : null,
            liquidatableFn ? viewFunctionResult(liquidatableFn, [], [accountAddress, object]) : null,
            Promise.all(
              (paramFns ?? []).map(async p => {
                const r = await viewFunctionResult(p.fn, [], [object])
                return [p.label, r.ok ? firstValue(r.data) : null] as const
              }),
            ),
          ])
          const entry: MarketLive = {}
          const priceNum = price?.ok ? Number(firstValue(price.data)) : NaN
          if (Number.isFinite(priceNum)) entry.oraclePrice = priceNum
          if (liq?.ok) entry.liquidatable = firstValue(liq.data) === true
          const kept = params.filter(([, v]) => v !== null)
          if (kept.length > 0) entry.params = Object.fromEntries(kept)
          liveByObject.set(normalizeAptosAddress(object), entry)
        }),
      ).catch(() => undefined)
    }
    const liveOf = (object: string) => liveByObject.get(normalizeAptosAddress(object)) ?? null

    try {
      readable = adapter.humanize(values, nameOf, liveOf)
    } catch {
      // Never let formatting take down the answer: the raw values still stand.
      readable = undefined
    }
  }

  return {
    protocol: adapter.name,
    accountLabel: adapter.accountLabel,
    accountAddress,
    values,
    ...(readable ? { readable } : {}),
    note: adapter.note,
  }
}

// Market lists are static enough to cache for the life of a warm lambda, and
// resolving them costs 1 + N view calls, which would otherwise blow the model's
// tool-round budget (Decibel has 60 markets).
export interface ProtocolMarket {
  name: string
  object: string
  /** Decimals for this market's size field. Decibel sets these per market. */
  szDecimals?: number
}

const marketCache = new Map<string, { at: number; markets: ProtocolMarket[] }>()
const MARKET_TTL_MS = 10 * 60_000

/** The market objects a trader's open positions point at. */
function heldMarketObjects(positions: unknown): string[] {
  if (!Array.isArray(positions)) return []
  const out: string[] = []
  for (const p of positions) {
    const object = unwrapObject((p as { market?: unknown } | null)?.market)
    if (object && !out.includes(object)) out.push(object)
  }
  return out
}

function unwrapObject(v: unknown): string | null {
  if (typeof v === "string") return v
  if (v && typeof v === "object" && "inner" in v) {
    const inner = (v as { inner?: unknown }).inner
    return typeof inner === "string" ? inner : null
  }
  return null
}

/**
 * All of a protocol's markets as name -> object address.
 *
 * Without this the model cannot answer ANY market-scoped question: list_markets
 * returns bare object addresses with no names, so naming them costs one view
 * call per market. At 60 markets that exceeds the tool-round budget entirely.
 * Resolving them server-side in parallel turns an impossible question into one
 * tool call.
 */
export async function getProtocolMarkets(
  adapter: ProtocolAdapter,
): Promise<ProtocolMarket[] | null> {
  if (!adapter.listMarketsFn || !adapter.marketNameFn) return null

  const cached = marketCache.get(adapter.name)
  if (cached && Date.now() - cached.at < MARKET_TTL_MS) return cached.markets

  const listed = await viewFunctionResult(adapter.listMarketsFn, [], [])
  if (!listed.ok) return null

  const raw = firstValue(listed.data)
  const objects = (Array.isArray(raw) ? raw : []).map(unwrapObject).filter((o): o is string => o !== null)
  if (objects.length === 0) return null

  const nameFn = adapter.marketNameFn
  const szFn = adapter.marketSizeDecimalsFn
  const named = await Promise.all(
    objects.slice(0, 120).map(async object => {
      const [r, sz] = await Promise.all([
        viewFunctionResult(nameFn, [], [object]),
        szFn ? viewFunctionResult(szFn, [], [object]) : Promise.resolve(null),
      ])
      const name = r.ok ? String(firstValue(r.data) ?? "") : ""
      if (!name) return null
      const dec = sz?.ok ? Number(firstValue(sz.data)) : NaN
      return { name, object, ...(Number.isFinite(dec) ? { szDecimals: dec } : {}) }
    }),
  )
  const markets = named.filter((m): m is ProtocolMarket => m !== null)
  if (markets.length === 0) return null

  markets.sort((a, b) => a.name.localeCompare(b.name))
  marketCache.set(adapter.name, { at: Date.now(), markets })
  return markets
}
