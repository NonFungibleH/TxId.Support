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
  /** Explains the account model, injected verbatim into the tool result. */
  note: string
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
    note:
      "On Decibel a trader's collateral and positions live in their subaccount object, NOT in their wallet. The wallet balance is only idle funds that have not been deposited. Always answer position and collateral questions from the subaccount figures below, and never present the wallet balance as the trading balance. IMPORTANT: crossCollateralValue covers CROSS margin only. Decibel also supports ISOLATED positions, whose collateral sits per market and is not included, so a zero cross figure does NOT mean the trader has no funds on the venue. If cross collateral is zero but the user believes they hold a position, say that you can see no cross-margin collateral and ask which market they traded, then read that market's isolated collateral rather than telling them they have nothing. delegatedPermissions and subaccountActive answer \"have I enabled trading?\": Decibel's \"Establish connection\" step delegates trading to a session key so orders can be placed gas-free, and these views report whether that is in place. Note that primary_subaccount returns a DERIVED address, so it resolves even for a wallet that has never used the protocol; when the account views abort, the subaccount object does not exist yet, which means the user has not completed setup rather than that anything is wrong. Say that plainly and tell them the setup step is the connection prompt in the app, but never send them off to read their status from the UI when these views answered it.",
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
 * Resolve a wallet to its protocol account and read that account's state.
 * Returns null only when the protocol account itself could not be resolved
 * (i.e. we genuinely do not know), never a fabricated empty portfolio.
 */
export async function getProtocolAccount(
  adapter: ProtocolAdapter,
  walletAddress: string,
): Promise<ProtocolAccount | null> {
  const wallet = normalizeAptosAddress(walletAddress)
  const resolved = await viewFunctionResult(adapter.resolveAccountFn, [], [wallet])

  if (!resolved.ok) {
    // Aborted here means this wallet has never created an account with the
    // protocol - a real answer worth giving.
    if (resolved.kind === "aborted") {
      return {
        protocol: adapter.name,
        accountLabel: adapter.accountLabel,
        accountAddress: null,
        values: {},
        note: `This wallet has no ${adapter.name} ${adapter.accountLabel} yet, so it has never deposited or traded there. ${adapter.note}`,
      }
    }
    return null
  }

  const accountAddress = String(firstValue(resolved.data) ?? "")
  if (!accountAddress.startsWith("0x")) return null

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

  return {
    protocol: adapter.name,
    accountLabel: adapter.accountLabel,
    accountAddress,
    values: Object.fromEntries(results),
    note: adapter.note,
  }
}

// Market lists are static enough to cache for the life of a warm lambda, and
// resolving them costs 1 + N view calls, which would otherwise blow the model's
// tool-round budget (Decibel has 60 markets).
const marketCache = new Map<string, { at: number; markets: { name: string; object: string }[] }>()
const MARKET_TTL_MS = 10 * 60_000

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
): Promise<{ name: string; object: string }[] | null> {
  if (!adapter.listMarketsFn || !adapter.marketNameFn) return null

  const cached = marketCache.get(adapter.name)
  if (cached && Date.now() - cached.at < MARKET_TTL_MS) return cached.markets

  const listed = await viewFunctionResult(adapter.listMarketsFn, [], [])
  if (!listed.ok) return null

  const raw = firstValue(listed.data)
  const objects = (Array.isArray(raw) ? raw : []).map(unwrapObject).filter((o): o is string => o !== null)
  if (objects.length === 0) return null

  const nameFn = adapter.marketNameFn
  const named = await Promise.all(
    objects.slice(0, 120).map(async object => {
      const r = await viewFunctionResult(nameFn, [], [object])
      const name = r.ok ? String(firstValue(r.data) ?? "") : ""
      return name ? { name, object } : null
    }),
  )
  const markets = named.filter((m): m is { name: string; object: string } => m !== null)
  if (markets.length === 0) return null

  markets.sort((a, b) => a.name.localeCompare(b.name))
  marketCache.set(adapter.name, { at: Date.now(), markets })
  return markets
}
