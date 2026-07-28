import type { AbortErrmap } from "./abort"
import { normalizeAptosAddress } from "./address"
import {
  aptosAuthHeaders,
  aptosFetch,
  aptosGet,
  formatUnits,
  getAccount,
  getAptosTransactionByHash,
  microsToIso,
  sleep,
  viewFunction,
} from "./fullnode"
import type { AptosBalance, AptosTransaction, AptosWalletDiagnosis } from "./types"

const INDEXER_URL = "https://api.mainnet.aptoslabs.com/v1/graphql"

interface GraphqlEnvelope<T> {
  data?: T
  errors?: unknown[]
}

// the gateway sometimes reports rate limiting as HTTP 200 with an errors[].extensions.code of "429"
function isRateLimitError(errors: unknown[]): boolean {
  return JSON.stringify(errors).includes('"429"')
}

async function graphqlOnce<T>(query: string, variables: Record<string, unknown>): Promise<GraphqlEnvelope<T> | null> {
  const res = await aptosFetch(INDEXER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...aptosAuthHeaders() },
    body: JSON.stringify({ query, variables }),
  })
  if (!res || !res.ok) return null
  try {
    return (await res.json()) as GraphqlEnvelope<T>
  } catch {
    return null
  }
}

export async function aptosGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T | null> {
  let json = await graphqlOnce<T>(query, variables)
  if (json?.errors && json.errors.length > 0 && isRateLimitError(json.errors)) {
    await sleep(2000)
    json = await graphqlOnce<T>(query, variables)
  }
  if (!json) return null
  if (json.errors && json.errors.length > 0) return null
  return json.data ?? null
}

const BALANCES_QUERY = `query WalletBalances($owner: String!) {
  current_fungible_asset_balances(
    where: { owner_address: { _eq: $owner }, amount: { _gt: "0" } }
    order_by: { amount: desc }
    limit: 30
  ) {
    asset_type
    amount
    metadata { name symbol decimals }
  }
}`

interface BalanceRow {
  asset_type: string
  amount: number | string
  metadata: { name: string; symbol: string; decimals: number } | null
}

function rawAmount(amount: number | string): string {
  return typeof amount === "string" ? amount : BigInt(Math.trunc(amount)).toString()
}

function isAptRow(row: BalanceRow): boolean {
  if (row.asset_type === "0x1::aptos_coin::AptosCoin") return true
  return row.metadata?.symbol === "APT" && row.asset_type === "0xa"
}

export async function getAptosWalletBalance(address: string): Promise<AptosBalance | null> {
  const owner = normalizeAptosAddress(address)
  const data = await aptosGraphql<{ current_fungible_asset_balances: BalanceRow[] }>(BALANCES_QUERY, { owner })
  if (!data) return null

  const rows = data.current_fungible_asset_balances
  const aptRow = rows.find(isAptRow) ?? null
  const aptRaw = aptRow ? rawAmount(aptRow.amount) : "0"

  const tokens = rows
    .filter(row => !isAptRow(row) && row.metadata !== null)
    .map(row => {
      const metadata = row.metadata as NonNullable<BalanceRow["metadata"]>
      return {
        assetType: row.asset_type,
        symbol: metadata.symbol,
        name: metadata.name,
        amount: formatUnits(rawAmount(row.amount), metadata.decimals),
        decimals: metadata.decimals,
      }
    })

  return { address: owner, aptBalance: formatUnits(aptRaw, 8), aptRaw, tokens }
}

const HISTORY_QUERY = `query AccountTransactions($addr: String!) {
  account_transactions(
    where: { account_address: { _eq: $addr } }
    order_by: { transaction_version: desc }
    limit: 25
  ) {
    transaction_version
  }
}`

async function hydrateVersions(versions: string[], stopAt?: number, errmap?: AbortErrmap): Promise<AptosTransaction[]> {
  const results: AptosTransaction[] = []
  for (let i = 0; i < versions.length; i += 3) {
    if (stopAt !== undefined && results.length >= stopAt) break
    if (i > 0) await sleep(300)
    const chunk = versions.slice(i, i + 3)
    const txs = await Promise.all(chunk.map(v => getAptosTransactionByHash(v, errmap)))
    for (const tx of txs) {
      if (tx) results.push(tx)
    }
  }
  return results
}

function functionIdMatchesModule(functionId: string | null, normalizedModuleAddress: string): boolean {
  if (!functionId) return false
  const sep = functionId.indexOf("::")
  if (sep === -1) return false
  return normalizeAptosAddress(functionId.slice(0, sep)) === normalizedModuleAddress
}

export async function getAptosRecentTransactions(
  address: string,
  moduleAddress?: string,
  limit = 10,
  errmap?: AbortErrmap
): Promise<AptosTransaction[] | null> {
  const addr = normalizeAptosAddress(address)
  const data = await aptosGraphql<{ account_transactions: { transaction_version: number | string }[] }>(
    HISTORY_QUERY,
    { addr }
  )
  if (!data) return null

  const versions = data.account_transactions.map(row => String(row.transaction_version))
  // Thread the protocol errmap so failed txs in the history decode to the
  // protocol's own error explanations, not a generic category reason.
  let txs = await hydrateVersions(versions, moduleAddress ? undefined : limit, errmap)
  if (moduleAddress) {
    const target = normalizeAptosAddress(moduleAddress)
    txs = txs.filter(tx => functionIdMatchesModule(tx.functionId, target))
  }
  return txs.slice(0, limit)
}

export interface AptosModuleEvent {
  /** Fully qualified Move event type, e.g. 0x50ea...::order::OrderFilled. */
  type: string
  data: unknown
  txHash: string
  version: string
  timestamp: string
  /** False when the emitting transaction itself failed. */
  success: boolean
  /** Entry function of the emitting transaction, when it was an entry-function call. */
  entryFunction: string | null
}

export interface AptosModuleEventScan {
  events: AptosModuleEvent[]
  /** Transactions actually fetched and inspected. The honest denominator. */
  transactionsScanned: number
  /**
   * True when transactions older than the scanned window exist, or the scan
   * stopped early. An empty `events` with truncated=true means "not seen in
   * this window", never "never happened".
   */
  truncated: boolean
  /** True when the scan stopped because it had collected enough matches. */
  matchLimitReached: boolean
  /** Oldest transaction inspected: the bound of how far back the scan looked. */
  oldestVersionScanned: string | null
  oldestTimestampScanned: string | null
  newestTimestampScanned: string | null
  /** Versions the indexer listed but the fullnode did not return. */
  hydrationFailures: number
}

const MODULE_TX_PAGE = 100
const MODULE_TX_HARD_CAP = 400
const MODULE_HYDRATE_CHUNK = 10

const MODULE_TX_PAGE_QUERY = `query ModuleTxVersions($addr: String!, $limit: Int!, $offset: Int!) {
  account_transactions(
    where: { account_address: { _eq: $addr } }
    order_by: { transaction_version: desc }
    limit: $limit
    offset: $offset
  ) {
    transaction_version
  }
}`

interface RawTransactionEvents {
  type: string
  hash: string
  version: string
  success: boolean
  timestamp: string
  payload?: { type: string; function?: string }
  events?: { type: string; data: unknown }[]
}

interface HydratedEvents {
  hash: string
  version: string
  success: boolean
  timestamp: string
  entryFunction: string | null
  events: { type: string; data: unknown }[]
}

/**
 * Deliberately not getAptosTransactionByHash: that mapper keeps only the first
 * 20 non-FeeStatement events, and on a busy protocol the event we are hunting
 * for is often past that cut. Event scanning needs the complete list.
 */
async function fetchTransactionEvents(version: string): Promise<HydratedEvents | null> {
  const raw = await aptosGet<RawTransactionEvents>(`/transactions/by_version/${version}`)
  if (!raw || !Array.isArray(raw.events)) return null
  const isEntryFunction = raw.payload?.type === "entry_function_payload"
  return {
    hash: raw.hash,
    version: raw.version,
    success: raw.success === true,
    timestamp: microsToIso(raw.timestamp),
    entryFunction: isEntryFunction ? (raw.payload?.function ?? null) : null,
    events: raw.events.map(e => ({ type: e.type, data: e.data })),
  }
}

// Mirrors the filter the AI tool layer applies: exact suffix or the generic form.
function eventMatchesName(type: string, name: string): boolean {
  const haystack = type.toLowerCase()
  const needle = `::${name.toLowerCase()}`
  return haystack.endsWith(needle) || haystack.includes(`${needle}<`)
}

function eventTypeAddress(type: string): string | null {
  const sep = type.indexOf("::")
  if (sep === -1) return null
  const prefix = type.slice(0, sep)
  return /^0x[0-9a-fA-F]{1,64}$/.test(prefix) ? normalizeAptosAddress(prefix) : null
}

async function collectModuleTxVersions(
  addr: string,
  maxTransactions: number
): Promise<{ versions: string[]; moreAvailable: boolean } | null> {
  const versions: string[] = []
  let moreAvailable = false
  for (let offset = 0; offset < maxTransactions; offset += MODULE_TX_PAGE) {
    const limit = Math.min(MODULE_TX_PAGE, maxTransactions - offset)
    const data = await aptosGraphql<{ account_transactions: { transaction_version: number | string }[] }>(
      MODULE_TX_PAGE_QUERY,
      { addr, limit, offset }
    )
    // A failed page after we already have rows is a partial answer, not a failed
    // lookup: keep what we have and say the window is truncated.
    if (!data || !Array.isArray(data.account_transactions)) {
      if (versions.length === 0) return null
      return { versions, moreAvailable: true }
    }
    const page = data.account_transactions
    versions.push(...page.map(row => String(row.transaction_version)))
    if (page.length < limit) return { versions, moreAvailable: false }
    moreAvailable = true
  }
  return { versions, moreAvailable }
}

/**
 * Protocol-defined Move events for a module, recovered by scanning the module's
 * transactions.
 *
 * The indexer's generic `events` table was deprecated and removed (querying it
 * returns "Request for Deprecated Resource: events") and no v2 replacement is
 * exposed, so a protocol's own events (order placed, position liquidated, fee
 * changed) exist only inside the transactions that emitted them. This pages
 * `account_transactions` for the module address, hydrates those versions from
 * the fullnode, and collects the matching events.
 *
 * The window is bounded, so the return shape reports what was actually covered:
 * callers must say "no match in the last N transactions", never "this event
 * never fired". Returns null only when the lookup itself failed.
 */
export async function getAptosModuleEvents(
  moduleAddress: string,
  eventNameFilter: string | null,
  opts?: { maxTransactions?: number; maxMatches?: number }
): Promise<AptosModuleEventScan | null> {
  const addr = normalizeAptosAddress(moduleAddress)
  const maxTransactions = Math.max(1, Math.min(MODULE_TX_HARD_CAP, opts?.maxTransactions ?? 150))
  const maxMatches = Math.max(1, Math.min(200, opts?.maxMatches ?? 25))

  const listed = await collectModuleTxVersions(addr, maxTransactions)
  if (!listed) return null
  // The indexer answered and this address has no transactions at all. Empty is
  // a real answer here, so it must not be reported as an outage.
  if (listed.versions.length === 0) {
    return {
      events: [],
      transactionsScanned: 0,
      truncated: false,
      matchLimitReached: false,
      oldestVersionScanned: null,
      oldestTimestampScanned: null,
      newestTimestampScanned: null,
      hydrationFailures: 0,
    }
  }

  const events: AptosModuleEvent[] = []
  let transactionsScanned = 0
  let hydrationFailures = 0
  let oldestVersionScanned: string | null = null
  let oldestTimestampScanned: string | null = null
  let newestTimestampScanned: string | null = null
  let matchLimitReached = false
  let inspectedAll = true

  for (let i = 0; i < listed.versions.length; i += MODULE_HYDRATE_CHUNK) {
    if (events.length >= maxMatches) {
      matchLimitReached = true
      inspectedAll = false
      break
    }
    if (i > 0) await sleep(100)
    const chunk = listed.versions.slice(i, i + MODULE_HYDRATE_CHUNK)
    const hydrated = await Promise.all(chunk.map(fetchTransactionEvents))
    for (const tx of hydrated) {
      if (!tx) {
        hydrationFailures++
        continue
      }
      transactionsScanned++
      // Versions are walked newest first, so the last one seen is the oldest.
      oldestVersionScanned = tx.version
      if (tx.timestamp) {
        oldestTimestampScanned = tx.timestamp
        if (!newestTimestampScanned) newestTimestampScanned = tx.timestamp
      }
      for (const e of tx.events) {
        const matches = eventNameFilter
          ? eventMatchesName(e.type, eventNameFilter)
          : // With no name to match, "this module's events" means events this
            // module actually declares. Framework noise (gas, coin transfers)
            // would otherwise drown them out.
            eventTypeAddress(e.type) === addr
        if (!matches) continue
        events.push({
          type: e.type,
          data: e.data,
          txHash: tx.hash,
          version: tx.version,
          timestamp: tx.timestamp,
          success: tx.success,
          entryFunction: tx.entryFunction,
        })
      }
    }
  }

  // Every hydration failed: we listed transactions but learned nothing about
  // them, which is a failed lookup rather than "this module emitted nothing".
  if (transactionsScanned === 0) return null

  if (events.length >= maxMatches) matchLimitReached = true
  return {
    events: events.slice(0, maxMatches),
    transactionsScanned,
    truncated: listed.moreAvailable || matchLimitReached || !inspectedAll,
    matchLimitReached,
    oldestVersionScanned,
    oldestTimestampScanned,
    newestTimestampScanned,
    hydrationFailures,
  }
}

const METADATA_QUERY = `query AssetMetadata($assetType: String!) {
  fungible_asset_metadata(where: { asset_type: { _eq: $assetType } }, limit: 1) {
    asset_type
    name
    symbol
    decimals
    supply_v2
  }
}`

export interface AptosAccountsForAuthKey {
  authKey: string
  /** Every address this auth key currently controls. Usually one. */
  addresses: { address: string; inUse: boolean | null; lastTransactionVersion: string | null }[]
}

/**
 * Which accounts an authentication key controls.
 *
 * NOT credential recovery: this is a public on-chain index, it needs no secret,
 * and nothing here can recover a lost key. It exists because Aptos lets an
 * account ROTATE its auth key while keeping its address
 * (0x1::account::rotate_authentication_key). After a rotation a wallet often
 * derives a fresh address from the new key, so the user sees an empty account
 * and believes their funds are gone. They are not: the original address still
 * exists and is still theirs. This maps key to address so that can be shown.
 *
 * Returns null on lookup failure, [] when the chain knows this key controls
 * nothing, so "no accounts" is never fabricated from an outage.
 */
export async function getAptosAccountsForAuthKey(authKey: string): Promise<AptosAccountsForAuthKey | null> {
  const key = normalizeAptosAddress(authKey)
  const data = await aptosGraphql<{
    auth_key_account_addresses: {
      account_address: string
      is_auth_key_used: boolean | null
      last_transaction_version: number | string | null
    }[]
  }>(
    `query AuthKeyAccounts($key: String!) {
      auth_key_account_addresses(where: { auth_key: { _eq: $key } }, limit: 25) {
        account_address
        is_auth_key_used
        last_transaction_version
      }
    }`,
    { key },
  )
  if (!data || !Array.isArray(data.auth_key_account_addresses)) return null
  return {
    authKey: key,
    addresses: data.auth_key_account_addresses.map(r => ({
      address: normalizeAptosAddress(r.account_address),
      inUse: r.is_auth_key_used ?? null,
      lastTransactionVersion: r.last_transaction_version === null || r.last_transaction_version === undefined
        ? null
        : String(r.last_transaction_version),
    })),
  }
}

export interface AptosAuthKeyStatus {
  address: string
  /** The auth key currently controlling this address. */
  authKey: string | null
  /** True when the auth key differs from the address, i.e. the key was rotated. */
  rotated: boolean | null
  /** Other addresses the same key controls, which is where "missing" funds usually are. */
  siblingAddresses: string[]
}

/**
 * Has this account rotated its key, and what else does that key control?
 * An unrotated Aptos account has auth key == address, so a mismatch is the
 * signal that a rotation happened.
 */
export async function getAptosAuthKeyStatus(address: string): Promise<AptosAuthKeyStatus | null> {
  const addr = normalizeAptosAddress(address)
  const acct = await aptosGet<{ data?: { authentication_key?: string } }>(
    `/accounts/${addr}/resource/0x1::account::Account`,
  )
  const authKey = acct?.data?.authentication_key ? normalizeAptosAddress(acct.data.authentication_key) : null
  if (!authKey) return { address: addr, authKey: null, rotated: null, siblingAddresses: [] }

  const siblings = await getAptosAccountsForAuthKey(authKey)
  return {
    address: addr,
    authKey,
    rotated: authKey !== addr,
    siblingAddresses: (siblings?.addresses ?? []).map(a => a.address).filter(a => a !== addr),
  }
}

export interface AptosDeployment {
  /** ISO timestamp of the account's first on-chain transaction. */
  timestamp: string
  /** Sender of that first transaction: whoever created/funded the account. */
  deployer: string
  txHash: string
  version: string
  /** Entry function of the first transaction, e.g. a package-publish call. */
  functionId: string | null
}

/**
 * Aptos has no "contract creation tx" like EVM: modules are published to an
 * account. The closest true equivalent is the account's FIRST transaction,
 * which for a module-publishing account is the publish (or the funding tx that
 * immediately precedes it). Returns null when the indexer/fullnode can't be
 * reached, so callers never report "never deployed" during an outage.
 */
export async function getAptosDeployment(address: string): Promise<AptosDeployment | null> {
  const owner = normalizeAptosAddress(address)
  const data = await aptosGraphql<{ account_transactions: { transaction_version: number | string }[] }>(
    `query FirstTx($owner: String!) {
      account_transactions(
        where: { account_address: { _eq: $owner } }
        order_by: { transaction_version: asc }
        limit: 1
      ) { transaction_version }
    }`,
    { owner }
  )
  const first = data?.account_transactions?.[0]
  if (!first) return null

  const tx = await getAptosTransactionByHash(String(first.transaction_version))
  if (!tx) return null
  return {
    timestamp: tx.timestamp,
    deployer: tx.sender,
    txHash: tx.hash,
    version: tx.version,
    functionId: tx.functionId,
  }
}

export interface AptosAssetActivity {
  /** Move event type, e.g. 0x1::fungible_asset::Deposit / Withdraw. */
  type: string
  amount: string | null
  assetType: string | null
  timestamp: string
  version: string
  /** Entry function that produced the event, when it was a user transaction. */
  entryFunction: string | null
  isFrozen: boolean | null
  success: boolean | null
  isGasFee: boolean
}

/**
 * Event-derived asset movement history for an account.
 *
 * The indexer's generic `events` table was deprecated and removed, but the
 * typed activity tables it was split into remain. `fungible_asset_activities`
 * carries the deposit/withdraw/mint/burn events for both legacy coins and the
 * fungible-asset standard, which is what "what moved, when, and via which
 * call" questions actually need. Arbitrary protocol-defined events (e.g. a
 * custom FeeChanged) are NOT queryable any more, so callers must not present
 * this as a complete event log.
 *
 * Gas-fee rows are excluded by default: every transaction produces one and
 * they drown out real activity.
 */
export async function getAptosAssetActivities(
  address: string,
  limit = 15,
  includeGasFees = false,
): Promise<AptosAssetActivity[] | null> {
  const owner = normalizeAptosAddress(address)
  const data = await aptosGraphql<{
    fungible_asset_activities: {
      type: string
      amount: number | string | null
      asset_type: string | null
      transaction_timestamp: string
      transaction_version: number | string
      entry_function_id_str: string | null
      is_frozen: boolean | null
      is_transaction_success: boolean | null
      is_gas_fee: boolean | null
    }[]
  }>(
    // Gas-fee rows are excluded in the QUERY, not after fetching: filtering
    // client-side could turn a page of pure gas rows into an empty array, which
    // the model would read as "this account has no activity".
    `query AssetActivities($owner: String!, $limit: Int!, $gasFilter: [Boolean!]) {
      fungible_asset_activities(
        where: { owner_address: { _eq: $owner }, is_gas_fee: { _in: $gasFilter } }
        order_by: { transaction_version: desc }
        limit: $limit
      ) {
        type
        amount
        asset_type
        transaction_timestamp
        transaction_version
        entry_function_id_str
        is_frozen
        is_transaction_success
        is_gas_fee
      }
    }`,
    { owner, limit: Math.min(100, limit), gasFilter: includeGasFees ? [true, false] : [false] }
  )
  // Anything other than a well-formed array means we did not get an answer.
  // Coercing that to [] would let the model report "no activity on this
  // account", which is a fabrication rather than a failed lookup.
  if (!data || !Array.isArray(data.fungible_asset_activities)) return null

  return data.fungible_asset_activities
    .map(r => ({
      type: r.type,
      amount: r.amount === null || r.amount === undefined ? null : String(r.amount),
      assetType: r.asset_type,
      timestamp: r.transaction_timestamp,
      version: String(r.transaction_version),
      entryFunction: r.entry_function_id_str,
      isFrozen: r.is_frozen ?? null,
      success: r.is_transaction_success ?? null,
      isGasFee: r.is_gas_fee === true,
    }))
}

export interface AptosTokenSafety {
  assetType: string
  symbol: string | null
  name: string | null
  decimals: number | null
  /** Who created the asset. */
  creator: string | null
  supply: string | null
  /** Hard cap on supply, when the asset declares one. null = uncapped. */
  maxSupply: string | null
  /** True when a hard cap exists, so supply cannot be inflated past it. */
  supplyCapped: boolean
  /** "v1" = legacy coin, "v2" = fungible asset. */
  standard: string | null
  /** Most recent activity, useful as a liveness/age signal. */
  lastActivity: string | null
  /** True when a freeze has actually been applied to a holder of this asset. */
  freezeObserved: boolean
  /** Declared icon URI. Empty/null is not a red flag on its own, just a fact. */
  iconUri: string | null
  /** Declared project URI. */
  projectUri: string | null
  /**
   * FACT: number of balance rows with a non-zero amount. Aptos stores fungible
   * assets per store, and one owner can hold several stores, so this is an
   * upper bound on distinct holders rather than an exact holder count.
   * null = the holder lookup did not answer, NOT zero holders.
   */
  holderCount: number | null
  /**
   * FACT: the largest non-zero balances, raw on-chain amounts, biggest first.
   * Owners are included because the top holder is very often a DEX pool or the
   * protocol's own treasury rather than a whale. null = lookup did not answer.
   */
  topHolders: { owner: string; amountRaw: string; isPrimary: boolean | null; isFrozen: boolean | null }[] | null
  /** DERIVED: largest balance as a percent of supply, e.g. "42.1234". */
  topHolderPercentOfSupply: string | null
  /** DERIVED: the returned top holders combined, as a percent of supply. */
  topHoldersPercentOfSupply: string | null
  /** How many balances the topHoldersPercentOfSupply ratio covers. */
  topHoldersCounted: number | null
  /** FACT: whether the creator address appears among the top holders. */
  creatorAmongTopHolders: boolean | null
  /** FACT: timestamp of the earliest indexed activity for this asset, i.e. its age. */
  firstActivity: string | null
  firstActivityVersion: string | null
  /** Move event type of that first activity, e.g. a mint. */
  firstActivityType: string | null
}

interface HolderRow {
  owner_address: string
  amount: number | string | null
  is_primary: boolean | null
  is_frozen: boolean | null
}

/**
 * Holder count and top balances live behind their own request on purpose: an
 * aggregate over a mega-cap asset can exceed the gateway's 10s budget, and a
 * timeout there must not cost us the metadata facts as well.
 */
async function getAssetHolders(assetType: string): Promise<{ count: number | null; top: HolderRow[] } | null> {
  const data = await aptosGraphql<{
    holderCount: { aggregate: { count: number } | null } | null
    topHolders: HolderRow[]
  }>(
    `query AssetHolders($asset: String!) {
      holderCount: current_fungible_asset_balances_aggregate(
        where: { asset_type: { _eq: $asset }, amount: { _gt: "0" } }
      ) { aggregate { count } }
      topHolders: current_fungible_asset_balances(
        where: { asset_type: { _eq: $asset }, amount: { _gt: "0" } }
        order_by: { amount: desc }
        limit: 10
      ) {
        owner_address
        amount
        is_primary
        is_frozen
      }
    }`,
    { asset: assetType }
  )
  if (!data || !Array.isArray(data.topHolders)) return null
  return { count: data.holderCount?.aggregate?.count ?? null, top: data.topHolders }
}

async function getAssetFirstActivity(
  assetType: string
): Promise<{ timestamp: string | null; version: string | null; type: string | null } | null> {
  const data = await aptosGraphql<{
    fungible_asset_activities: { transaction_timestamp: string; transaction_version: number | string; type: string }[]
  }>(
    `query AssetFirstActivity($asset: String!) {
      fungible_asset_activities(
        where: { asset_type: { _eq: $asset } }
        order_by: { transaction_version: asc }
        limit: 1
      ) {
        transaction_timestamp
        transaction_version
        type
      }
    }`,
    { asset: assetType }
  )
  if (!data || !Array.isArray(data.fungible_asset_activities)) return null
  const first = data.fungible_asset_activities[0]
  if (!first) return { timestamp: null, version: null, type: null }
  return { timestamp: first.transaction_timestamp, version: String(first.transaction_version), type: first.type }
}

/** Percent of `supply` with 4 decimals, as a string. null when either side is unusable. */
function percentOfSupply(amountRaw: bigint, supply: string | null): string | null {
  // supply_v2 is a numeric column, so it can arrive as "1000000" or "1000000.0".
  const supplyDigits = supply === null ? "" : (supply.split(".")[0] ?? "")
  if (!/^\d+$/.test(supplyDigits)) return null
  const total = BigInt(supplyDigits)
  if (total === 0n) return null
  const scaled = (amountRaw * 1_000_000n) / total
  const whole = scaled / 10_000n
  const frac = (scaled % 10_000n).toString().padStart(4, "0")
  return `${whole}.${frac}`
}

function toBigIntOrNull(amount: number | string | null): bigint | null {
  if (amount === null || amount === undefined) return null
  try {
    return BigInt(typeof amount === "string" ? amount.split(".")[0] ?? "0" : Math.trunc(amount))
  } catch {
    return null
  }
}

/**
 * Aptos-native safety signals for a fungible asset.
 *
 * There is no GoPlus-style scanner for Aptos (GoPlus covers 44 chains, none of
 * them Aptos), so instead of guessing we report the facts Aptos publishes
 * on-chain: who created the asset, whether supply is hard-capped or can be
 * inflated, which standard it uses, how recently it has been active, and
 * whether any holder has actually been frozen (i.e. a freeze capability is
 * real and in use), how concentrated the supply is, and how old the asset is.
 * These are signals, not a verdict, and callers must present them that way.
 *
 * The holder and age lookups are best effort: when one does not answer, its
 * fields stay null and the rest of the facts are still returned. null on those
 * fields means "not known", never "zero".
 */
export async function getAptosTokenSafety(assetType: string): Promise<AptosTokenSafety | null> {
  const [core, holders, firstActivity] = await Promise.all([
    getTokenSafetyCore(assetType),
    getAssetHolders(assetType),
    getAssetFirstActivity(assetType),
  ])
  if (!core) return null

  const topHolders =
    holders?.top.map(row => ({
      owner: row.owner_address,
      amountRaw: toBigIntOrNull(row.amount)?.toString() ?? "0",
      isPrimary: row.is_primary ?? null,
      isFrozen: row.is_frozen ?? null,
    })) ?? null

  const amounts = holders?.top.map(row => toBigIntOrNull(row.amount) ?? 0n) ?? []
  const largest = amounts[0] ?? null
  const combined = amounts.reduce((sum, a) => sum + a, 0n)

  return {
    ...core,
    holderCount: holders ? holders.count : null,
    topHolders,
    topHolderPercentOfSupply: largest === null ? null : percentOfSupply(largest, core.supply),
    topHoldersPercentOfSupply: amounts.length === 0 ? null : percentOfSupply(combined, core.supply),
    topHoldersCounted: holders ? amounts.length : null,
    creatorAmongTopHolders:
      holders && core.creator
        ? holders.top.some(row => normalizeAptosAddress(row.owner_address) === normalizeAptosAddress(core.creator as string))
        : null,
    firstActivity: firstActivity?.timestamp ?? null,
    firstActivityVersion: firstActivity?.version ?? null,
    firstActivityType: firstActivity?.type ?? null,
  }
}

type AptosTokenSafetyCore = Pick<
  AptosTokenSafety,
  | "assetType"
  | "symbol"
  | "name"
  | "decimals"
  | "creator"
  | "supply"
  | "maxSupply"
  | "supplyCapped"
  | "standard"
  | "lastActivity"
  | "freezeObserved"
  | "iconUri"
  | "projectUri"
>

async function getTokenSafetyCore(assetType: string): Promise<AptosTokenSafetyCore | null> {
  const data = await aptosGraphql<{
    fungible_asset_metadata: {
      asset_type: string
      symbol: string | null
      name: string | null
      decimals: number | null
      creator_address: string | null
      supply_v2: number | string | null
      maximum_v2: number | string | null
      token_standard: string | null
      last_transaction_timestamp: string | null
      icon_uri: string | null
      project_uri: string | null
    }[]
    fungible_asset_activities: { is_frozen: boolean | null }[]
  }>(
    `query TokenSafety($asset: String!) {
      fungible_asset_metadata(where: { asset_type: { _eq: $asset } }, limit: 1) {
        asset_type
        symbol
        name
        decimals
        creator_address
        supply_v2
        maximum_v2
        token_standard
        last_transaction_timestamp
        icon_uri
        project_uri
      }
      fungible_asset_activities(
        where: { asset_type: { _eq: $asset }, is_frozen: { _eq: true } }
        limit: 1
      ) { is_frozen }
    }`,
    { asset: assetType }
  )
  if (!data) return null

  const meta = data.fungible_asset_metadata?.[0]
  if (!meta) return null
  const max = meta.maximum_v2 === null || meta.maximum_v2 === undefined ? null : String(meta.maximum_v2)
  return {
    assetType: meta.asset_type,
    symbol: meta.symbol,
    name: meta.name,
    decimals: meta.decimals,
    creator: meta.creator_address,
    supply: meta.supply_v2 === null || meta.supply_v2 === undefined ? null : String(meta.supply_v2),
    maxSupply: max,
    supplyCapped: max !== null,
    standard: meta.token_standard,
    lastActivity: meta.last_transaction_timestamp,
    freezeObserved: (data.fungible_asset_activities ?? []).length > 0,
    iconUri: meta.icon_uri,
    projectUri: meta.project_uri,
  }
}

export interface AptosAssetMetadata {
  assetType: string
  name: string
  symbol: string
  decimals: number
  supply?: string
}

// null = the indexer could not be reached (fetch failed); [] = the indexer
// answered and knows no such asset: callers must keep the two distinct.
export async function getAptosAssetMetadata(assetType: string): Promise<AptosAssetMetadata[] | null> {
  const data = await aptosGraphql<{
    fungible_asset_metadata: {
      asset_type: string
      name: string
      symbol: string
      decimals: number
      supply_v2: number | string | null
    }[]
  }>(METADATA_QUERY, { assetType })
  if (!data) return null
  return data.fungible_asset_metadata.map(row => ({
    assetType: row.asset_type,
    name: row.name,
    symbol: row.symbol,
    decimals: row.decimals,
    ...(row.supply_v2 !== null && row.supply_v2 !== undefined
      ? { supply: formatUnits(rawAmount(row.supply_v2), row.decimals) }
      : {}),
  }))
}

export async function diagnoseAptosWallet(address: string): Promise<AptosWalletDiagnosis> {
  const addr = normalizeAptosAddress(address)
  const [account, balanceResult, recent] = await Promise.all([
    getAccount(addr),
    viewFunction("0x1::coin::balance", ["0x1::aptos_coin::AptosCoin"], [addr]),
    getAptosRecentTransactions(addr, undefined, 10),
  ])
  const octas = balanceResult?.[0]
  return {
    exists: account !== null,
    sequenceNumber: account?.sequenceNumber ?? null,
    aptBalance: typeof octas === "string" ? formatUnits(octas, 8) : null,
    recentFailureCount: recent ? recent.filter(tx => !tx.success).length : null,
  }
}
