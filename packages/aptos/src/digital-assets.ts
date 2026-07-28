import { normalizeAptosAddress } from "./address"
import { aptosGraphql } from "./indexer"

/**
 * Digital Asset (Token v2) and legacy Token v1 reads for Aptos.
 *
 * NFTs on Aptos come in two shapes that share one indexer surface: legacy
 * Token v1, where a transfer is an OFFER the recipient must claim, and Token v2
 * Digital Assets, which are objects and land directly. Both are reported by
 * current_token_ownerships_v2 with a token_standard discriminator, so callers
 * must keep the standard visible: it changes the answer to almost every
 * support question about a missing NFT.
 *
 * NULL VS EMPTY, the package-wide rule: null means the lookup FAILED, i.e. we
 * never got an answer from the indexer. An empty array means the indexer
 * answered and the chain genuinely has nothing. Callers must never conflate
 * them: reporting "you hold no NFTs" during an outage is a fabrication.
 */

/** Indexer numeric columns come back as JSON numbers, so normalise without losing large integers. */
function rawAmount(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  return Number.isFinite(value) ? BigInt(Math.trunc(value)).toString() : null
}

function rawVersion(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  return Number.isFinite(value) ? BigInt(Math.trunc(value)).toString() : null
}

export interface AptosNftHolding {
  /** Stable id of the token. For v2 this is the token object's address. */
  tokenDataId: string
  tokenName: string | null
  collectionName: string | null
  collectionId: string | null
  creator: string | null
  /** Usually "1" for a true NFT. Semi-fungible editions can hold more. */
  amount: string | null
  /** "v1" = legacy Token, "v2" = Digital Asset. */
  standard: string | null
  /** True when the owner cannot transfer it, i.e. soulbound. null when the indexer did not say. */
  soulbound: boolean | null
  tokenUri: string | null
  lastTransactionVersion: string | null
  lastActivity: string | null
}

interface OwnershipRow {
  token_data_id: string
  amount: number | string | null
  is_soulbound_v2: boolean | null
  is_fungible_v2: boolean | null
  non_transferrable_by_owner: boolean | null
  token_standard: string | null
  last_transaction_version: number | string | null
  last_transaction_timestamp: string | null
  current_token_data: {
    token_name: string | null
    token_uri: string | null
    current_collection: { collection_name: string | null; collection_id: string | null; creator_address: string | null } | null
  } | null
}

/**
 * The account's NFT holdings across Token v1 and Token v2.
 *
 * Fungible rows are excluded in the QUERY rather than after fetching: this
 * table also carries fungible-asset balances, and filtering client-side could
 * turn a page of fungible rows into an empty array, which reads as "you own no
 * NFTs". The filter spells out the null case explicitly because SQL treats
 * `is_fungible_v2 <> true` as unknown when the column is null, which would
 * silently drop legacy v1 rows.
 */
export async function getAptosNfts(ownerAddress: string, limit = 25): Promise<AptosNftHolding[] | null> {
  const owner = normalizeAptosAddress(ownerAddress)
  const data = await aptosGraphql<{ current_token_ownerships_v2: OwnershipRow[] }>(
    `query AptosNfts($owner: String!, $limit: Int!) {
      current_token_ownerships_v2(
        where: {
          owner_address: { _eq: $owner }
          amount: { _gt: "0" }
          _or: [{ is_fungible_v2: { _is_null: true } }, { is_fungible_v2: { _eq: false } }]
        }
        order_by: { last_transaction_version: desc }
        limit: $limit
      ) {
        token_data_id
        amount
        is_soulbound_v2
        is_fungible_v2
        non_transferrable_by_owner
        token_standard
        last_transaction_version
        last_transaction_timestamp
        current_token_data {
          token_name
          token_uri
          current_collection {
            collection_name
            collection_id
            creator_address
          }
        }
      }
    }`,
    { owner, limit: Math.min(100, Math.max(1, limit)) }
  )
  if (!data || !Array.isArray(data.current_token_ownerships_v2)) return null

  return data.current_token_ownerships_v2.map(row => {
    const tokenData = row.current_token_data
    const collection = tokenData?.current_collection ?? null
    return {
      tokenDataId: row.token_data_id,
      tokenName: tokenData?.token_name ?? null,
      collectionName: collection?.collection_name ?? null,
      collectionId: collection?.collection_id ?? null,
      creator: collection?.creator_address ?? null,
      amount: rawAmount(row.amount),
      standard: row.token_standard,
      soulbound: row.is_soulbound_v2 ?? row.non_transferrable_by_owner ?? null,
      tokenUri: tokenData?.token_uri ?? null,
      lastTransactionVersion: rawVersion(row.last_transaction_version),
      lastActivity: row.last_transaction_timestamp,
    }
  })
}

export interface AptosPendingNftClaim {
  /** Who sent the token. */
  from: string
  /** Who it was sent to, i.e. the address that still has to claim it. */
  to: string
  tokenName: string | null
  collectionName: string | null
  tokenDataId: string
  creator: string | null
  amount: string | null
  propertyVersion: string | null
  lastTransactionVersion: string | null
  lastActivity: string | null
}

interface PendingClaimRow {
  from_address: string
  to_address: string
  name: string | null
  collection_name: string | null
  token_data_id: string
  creator_address: string | null
  amount: number | string | null
  property_version: number | string | null
  last_transaction_version: number | string | null
  last_transaction_timestamp: string | null
}

/**
 * Tokens that were sent to this address but have NOT been claimed yet.
 *
 * WHY THIS EXISTS: it answers the single most common NFT support ticket on
 * Aptos, "I was sent an NFT and it never arrived". On legacy Token v1 a
 * transfer is an OFFER, not a delivery: unless the recipient has switched on
 * direct transfer, the token sits in a pending-claim table until they call
 * claim_script. The sender sees a successful transaction, the recipient sees
 * nothing in their wallet, and both conclude the token is lost. It is not: it
 * is sitting here, and this is the only place on chain that says so. A non
 * empty result turns an unanswerable ticket into a one line instruction.
 * Token v2 Digital Assets do not use this path, so an empty result for a v2
 * transfer means the problem is somewhere else.
 */
export async function getAptosPendingNftClaims(address: string, limit = 25): Promise<AptosPendingNftClaim[] | null> {
  const addr = normalizeAptosAddress(address)
  const data = await aptosGraphql<{ current_token_pending_claims: PendingClaimRow[] }>(
    `query AptosPendingNftClaims($addr: String!, $limit: Int!) {
      current_token_pending_claims(
        where: { to_address: { _eq: $addr }, amount: { _gt: "0" } }
        order_by: { last_transaction_version: desc }
        limit: $limit
      ) {
        from_address
        to_address
        name
        collection_name
        token_data_id
        creator_address
        amount
        property_version
        last_transaction_version
        last_transaction_timestamp
      }
    }`,
    { addr, limit: Math.min(100, Math.max(1, limit)) }
  )
  if (!data || !Array.isArray(data.current_token_pending_claims)) return null

  return data.current_token_pending_claims.map(row => ({
    from: row.from_address,
    to: row.to_address,
    tokenName: row.name,
    collectionName: row.collection_name,
    tokenDataId: row.token_data_id,
    creator: row.creator_address,
    amount: rawAmount(row.amount),
    propertyVersion: rawVersion(row.property_version),
    lastTransactionVersion: rawVersion(row.last_transaction_version),
    lastActivity: row.last_transaction_timestamp,
  }))
}

export interface AptosNftActivityEntry {
  /** Move event type, e.g. 0x4::collection::Mint or 0x1::object::TransferEvent. */
  type: string
  from: string | null
  to: string | null
  amount: string | null
  tokenDataId: string
  standard: string | null
  version: string | null
  timestamp: string | null
  /** Entry function that produced the event, when it was a user transaction. */
  entryFunction: string | null
  propertyVersion: string | null
}

/** Recent mint and transfer activity for one token, newest first. */
export async function getAptosNftActivity(tokenDataId: string, limit = 15): Promise<AptosNftActivityEntry[] | null> {
  const data = await aptosGraphql<{
    token_activities_v2: {
      type: string
      from_address: string | null
      to_address: string | null
      token_amount: number | string | null
      token_data_id: string
      token_standard: string | null
      transaction_version: number | string | null
      transaction_timestamp: string | null
      entry_function_id_str: string | null
      property_version_v1: number | string | null
    }[]
  }>(
    `query AptosNftActivity($tokenDataId: String!, $limit: Int!) {
      token_activities_v2(
        where: { token_data_id: { _eq: $tokenDataId } }
        order_by: { transaction_version: desc }
        limit: $limit
      ) {
        type
        from_address
        to_address
        token_amount
        token_data_id
        token_standard
        transaction_version
        transaction_timestamp
        entry_function_id_str
        property_version_v1
      }
    }`,
    { tokenDataId, limit: Math.min(100, Math.max(1, limit)) }
  )
  if (!data || !Array.isArray(data.token_activities_v2)) return null

  return data.token_activities_v2.map(row => ({
    type: row.type,
    from: row.from_address,
    to: row.to_address,
    amount: rawAmount(row.token_amount),
    tokenDataId: row.token_data_id,
    standard: row.token_standard,
    version: rawVersion(row.transaction_version),
    timestamp: row.transaction_timestamp,
    entryFunction: row.entry_function_id_str,
    propertyVersion: rawVersion(row.property_version_v1),
  }))
}
