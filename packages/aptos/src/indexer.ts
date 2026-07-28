import type { AbortErrmap } from "./abort"
import { normalizeAptosAddress } from "./address"
import {
  aptosAuthHeaders,
  aptosFetch,
  formatUnits,
  getAccount,
  getAptosTransactionByHash,
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

const METADATA_QUERY = `query AssetMetadata($assetType: String!) {
  fungible_asset_metadata(where: { asset_type: { _eq: $assetType } }, limit: 1) {
    asset_type
    name
    symbol
    decimals
    supply_v2
  }
}`

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
}

/**
 * Aptos-native safety signals for a fungible asset.
 *
 * There is no GoPlus-style scanner for Aptos (GoPlus covers 44 chains, none of
 * them Aptos), so instead of guessing we report the facts Aptos publishes
 * on-chain: who created the asset, whether supply is hard-capped or can be
 * inflated, which standard it uses, how recently it has been active, and
 * whether any holder has actually been frozen (i.e. a freeze capability is
 * real and in use). These are signals, not a verdict, and callers must present
 * them that way.
 */
export async function getAptosTokenSafety(assetType: string): Promise<AptosTokenSafety | null> {
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
// answered and knows no such asset — callers must keep the two distinct.
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
