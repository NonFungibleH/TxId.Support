import { normalizeAptosAddress } from "./address"
import { aptosGet } from "./fullnode"
import { aptosGraphql } from "./indexer"

/**
 * Object reads for Aptos.
 *
 * WHY THIS EXISTS: Aptos protocols are built on objects, not on per-user
 * mappings inside one contract. Decibel gives every trader their own Subaccount
 * object and every market is a PerpMarket object, so the addresses users paste
 * into support chats are very often object addresses rather than wallets. An
 * object address looks exactly like an account address (0x + 64 hex) but nobody
 * holds its private key: it is a container owned BY an account. A bot that
 * cannot tell the two apart answers "that wallet is empty" about a perp market,
 * which is worse than saying nothing.
 *
 * NULL VS EMPTY, the package-wide rule: null means the lookup FAILED, i.e. we
 * never got an answer from the indexer. An empty array, or a found:false
 * lookup, means the indexer answered and the chain genuinely has nothing.
 * Callers must never conflate them: "no objects" during an outage is a
 * fabrication, not a fact.
 */

/** Indexer numeric columns come back as JSON numbers, so normalise without losing large integers. */
function rawVersion(value: number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === "string") return value
  return Number.isFinite(value) ? BigInt(Math.trunc(value)).toString() : null
}

export interface AptosObject {
  /** The object's own address. This is a container, NOT a wallet: no private key controls it. */
  address: string
  /** The account (or parent object) that currently owns this object. */
  owner: string
  /**
   * False when transfer is gated, i.e. the owner cannot simply move it. This is
   * how soulbound objects and protocol-controlled objects present on chain.
   */
  allowUngatedTransfer: boolean
  /** True once the object has been burned. A deleted object still has a row here. */
  isDeleted: boolean
  /** Ledger version of the last transaction that touched the object. */
  lastTransactionVersion: string | null
  stateKeyHash: string | null
  /**
   * Move resource types stored at the object address, e.g. 0x4::token::Token or
   * a protocol's own ::subaccount::Subaccount. This is what lets a caller say
   * WHAT the object is rather than only who owns it. null means the fullnode
   * could not be reached, which is not the same as an object with no resources.
   */
  resourceTypes: string[] | null
  /** True when the object carries 0x4::token::Token, i.e. it is a Digital Asset. null when resourceTypes is null. */
  isDigitalAsset: boolean | null
}

export type AptosObjectLookup =
  /** The indexer knows this address as an object. */
  | { found: true; object: AptosObject }
  /** The indexer answered and has no object row: the address is not an object. */
  | { found: false; address: string }

interface ObjectRow {
  object_address: string
  owner_address: string
  allow_ungated_transfer: boolean | null
  is_deleted: boolean | null
  last_transaction_version: number | string | null
  state_key_hash: string | null
}

const OBJECT_FIELDS = `object_address
    owner_address
    allow_ungated_transfer
    is_deleted
    last_transaction_version
    state_key_hash`

async function getResourceTypes(address: string): Promise<string[] | null> {
  const resources = await aptosGet<{ type: string }[]>(`/accounts/${address}/resources?limit=100`)
  if (!Array.isArray(resources)) return null
  return resources.map(r => r.type).filter(t => typeof t === "string")
}

/**
 * Ownership and transferability of a single object.
 *
 * Returns null only when the indexer could not be reached. When the indexer
 * answers with no row the result is found:false, so a caller can say "that
 * address is not an object" instead of "I could not check".
 */
export async function getAptosObject(objectAddress: string): Promise<AptosObjectLookup | null> {
  const addr = normalizeAptosAddress(objectAddress)
  const [data, resourceTypes] = await Promise.all([
    aptosGraphql<{ current_objects: ObjectRow[] }>(
      `query AptosObject($addr: String!) {
        current_objects(where: { object_address: { _eq: $addr } }, limit: 1) {
          ${OBJECT_FIELDS}
        }
      }`,
      { addr }
    ),
    getResourceTypes(addr),
  ])
  if (!data || !Array.isArray(data.current_objects)) return null

  const row = data.current_objects[0]
  if (!row) return { found: false, address: addr }

  return {
    found: true,
    object: {
      address: row.object_address,
      owner: row.owner_address,
      allowUngatedTransfer: row.allow_ungated_transfer === true,
      isDeleted: row.is_deleted === true,
      lastTransactionVersion: rawVersion(row.last_transaction_version),
      stateKeyHash: row.state_key_hash,
      resourceTypes,
      isDigitalAsset: resourceTypes === null ? null : resourceTypes.some(t => t.startsWith("0x4::token::Token")),
    },
  }
}

export interface AptosOwnedObject {
  address: string
  owner: string
  allowUngatedTransfer: boolean
  isDeleted: boolean
  lastTransactionVersion: string | null
  stateKeyHash: string | null
}

/**
 * Objects currently owned by an account, newest activity first. Burned objects
 * are excluded because they are no longer holdings, but a caller checking one
 * specific address should use getAptosObject, which still reports them.
 */
export async function getAptosObjectsOwnedBy(ownerAddress: string, limit = 25): Promise<AptosOwnedObject[] | null> {
  const owner = normalizeAptosAddress(ownerAddress)
  const data = await aptosGraphql<{ current_objects: ObjectRow[] }>(
    `query AptosObjectsOwned($owner: String!, $limit: Int!) {
      current_objects(
        where: { owner_address: { _eq: $owner }, is_deleted: { _eq: false } }
        order_by: { last_transaction_version: desc }
        limit: $limit
      ) {
        ${OBJECT_FIELDS}
      }
    }`,
    { owner, limit: Math.min(100, Math.max(1, limit)) }
  )
  if (!data || !Array.isArray(data.current_objects)) return null

  return data.current_objects.map(row => ({
    address: row.object_address,
    owner: row.owner_address,
    allowUngatedTransfer: row.allow_ungated_transfer === true,
    isDeleted: row.is_deleted === true,
    lastTransactionVersion: rawVersion(row.last_transaction_version),
    stateKeyHash: row.state_key_hash,
  }))
}
