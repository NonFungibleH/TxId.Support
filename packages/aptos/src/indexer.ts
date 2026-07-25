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
