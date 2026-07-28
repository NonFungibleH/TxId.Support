import { normalizeAptosAddress } from "./address"
import { sleep, viewFunctionResult } from "./fullnode"
import { aptosGraphql } from "./indexer"

/**
 * Delegated staking reads for Aptos.
 *
 * WHY THIS EXISTS: staking is the single largest retail support surface on
 * Aptos. "When can I unstake?", "why have my rewards not moved?" and "my
 * validator went inactive" are all answerable from on-chain data, and all three
 * are answered wrongly by guessing. A delegator's funds sit in one of three
 * buckets (active, pending_inactive, inactive) and only the inactive bucket is
 * withdrawable, so a bot that reports a single "staked balance" tells people
 * they can withdraw money they cannot touch for another 30 days.
 *
 * NULL VS EMPTY, the package-wide rule: null means the lookup FAILED, i.e. we
 * never got an answer from the indexer or the fullnode. An empty array means
 * the chain answered and genuinely has nothing. Callers must never conflate
 * them, because "[] delegations" reads as "you have never staked" and during an
 * outage that is a fabrication, not a fact.
 *
 * All amounts are returned as RAW OCTA strings (1 APT = 1e8 octas). Formatting
 * is the caller's job, matching the rest of this package.
 */

/** Aptos returns numeric indexer columns as JSON numbers, so normalise to a string without losing integers. */
function rawAmount(amount: number | string): string {
  if (typeof amount === "string") return amount
  if (!Number.isFinite(amount)) return "0"
  return BigInt(Math.trunc(amount)).toString()
}

/** Share balances are fractional, so they keep their decimal form rather than being truncated like octas. */
function shareAmount(shares: number | string | null | undefined): string | null {
  if (shares === null || shares === undefined) return null
  if (typeof shares === "string") return shares
  return Number.isFinite(shares) ? String(shares) : null
}

function secondsToIso(secs: string): string | null {
  const n = Number(secs)
  if (!Number.isFinite(n) || n <= 0) return null
  const date = new Date(n * 1000)
  const iso = Number.isFinite(date.getTime()) ? date.toISOString() : null
  return iso
}

function asOctaString(value: unknown): string | null {
  if (typeof value === "string" && /^\d+$/.test(value)) return value
  if (typeof value === "number" && Number.isFinite(value)) return BigInt(Math.trunc(value)).toString()
  return null
}

/**
 * A Move view that reads a resource aborts when the resource was never created.
 * For staking that means "there is no stake pool at this address", which is a
 * real answer to give a user who pasted the wrong address, not an outage.
 */
function isMissingPool(message: string): boolean {
  return /stake_pool_does_not_exist|delegation_pool_does_not_exist|failed to borrow global resource|resource not found/i.test(
    message,
  )
}

export interface AptosDelegatorStake {
  poolAddress: string
  delegatorAddress: string
  /** False when the chain reports no delegation pool at this address. */
  poolExists: boolean
  /** Octas currently earning rewards. */
  activeOctas: string | null
  /** Octas that have finished unlocking and are withdrawable right now. */
  inactiveOctas: string | null
  /** Octas unlocking, released to inactive at the end of the current lockup cycle. */
  pendingInactiveOctas: string | null
  /** The chain's explanation when poolExists is false. */
  reason: string | null
}

/**
 * Authoritative per-pool stake split via 0x1::delegation_pool::get_stake.
 *
 * This view is the ONLY source that returns the three buckets in octas. The
 * indexer stores share balances instead, and shares convert to coins only
 * through the pool's current total_coins/total_shares ratio, which arrives as a
 * float and drifts every epoch as rewards accrue. Deriving a withdrawable
 * balance from that would produce a number that looks precise and is not.
 *
 * Returns null only when the node could not be reached.
 */
export async function getAptosStakeFromChain(
  poolAddress: string,
  delegatorAddress: string,
): Promise<AptosDelegatorStake | null> {
  const pool = normalizeAptosAddress(poolAddress)
  const delegator = normalizeAptosAddress(delegatorAddress)
  const res = await viewFunctionResult("0x1::delegation_pool::get_stake", [], [pool, delegator])

  if (!res.ok) {
    if (res.kind === "aborted") {
      return {
        poolAddress: pool,
        delegatorAddress: delegator,
        poolExists: !isMissingPool(res.message),
        activeOctas: null,
        inactiveOctas: null,
        pendingInactiveOctas: null,
        reason: res.message,
      }
    }
    return null
  }

  // The view returns the tuple (active, inactive, pending_inactive).
  const [active, inactive, pendingInactive] = res.data
  return {
    poolAddress: pool,
    delegatorAddress: delegator,
    poolExists: true,
    activeOctas: asOctaString(active),
    inactiveOctas: asOctaString(inactive),
    pendingInactiveOctas: asOctaString(pendingInactive),
    reason: null,
  }
}

export interface AptosDelegationPosition {
  poolAddress: string
  /** Octas earning rewards. null when the on-chain amount could not be read. */
  activeOctas: string | null
  /** Octas withdrawable right now. */
  inactiveOctas: string | null
  /** Octas unlocking until the end of the current lockup cycle. */
  pendingInactiveOctas: string | null
  /** "chain" when the octa amounts came from the delegation pool view, "unavailable" when that read failed. */
  amountsSource: "chain" | "unavailable"
  /** Indexer share balance in the active pool. Shares, NOT octas, and only useful as evidence a position exists. */
  activeShares: string | null
  /** Indexer share balance in the inactive pool. Shares, NOT octas. */
  inactiveShares: string | null
  /** Operator commission in basis points, e.g. 700 = 7% of rewards. */
  operatorCommissionBps: number | null
  /** Version of the last indexed change to this position. */
  lastTransactionVersion: string | null
}

interface DelegatorBalanceRow {
  pool_address: string
  pool_type: string
  shares: number | string
  last_transaction_version: number | string
  current_pool_balance: {
    total_coins: number | string
    total_shares: number | string
    operator_commission_percentage: number | string
  } | null
}

const DELEGATIONS_QUERY = `query Delegations($delegator: String!) {
  current_delegator_balances(
    where: { delegator_address: { _eq: $delegator }, shares: { _gt: "0" } }
    order_by: { pool_address: asc }
    limit: 60
  ) {
    pool_address
    pool_type
    shares
    last_transaction_version
    current_pool_balance {
      total_coins
      total_shares
      operator_commission_percentage
    }
  }
}`

/** Read the on-chain triple for several pools without opening a burst of view calls at once. */
async function stakeForPools(
  pools: string[],
  delegator: string,
): Promise<Map<string, AptosDelegatorStake | null>> {
  const out = new Map<string, AptosDelegatorStake | null>()
  for (let i = 0; i < pools.length; i += 4) {
    if (i > 0) await sleep(200)
    const chunk = pools.slice(i, i + 4)
    const results = await Promise.all(chunk.map(pool => getAptosStakeFromChain(pool, delegator)))
    chunk.forEach((pool, idx) => out.set(pool, results[idx] ?? null))
  }
  return out
}

/**
 * Every delegation position held by a wallet.
 *
 * The indexer is used to DISCOVER which pools the wallet delegates to, which is
 * the one thing no single view can answer, then each pool's amounts are read
 * from the chain so the numbers are exact. A wallet normally delegates to a
 * handful of pools at most.
 *
 * Returns null when the indexer lookup failed, [] when the wallet genuinely
 * delegates nowhere. A position whose on-chain read failed is still returned,
 * with null amounts and amountsSource "unavailable", so the caller can say
 * "you have a position here but I could not read the balance" instead of
 * silently dropping it.
 */
export async function getAptosDelegations(address: string): Promise<AptosDelegationPosition[] | null> {
  const delegator = normalizeAptosAddress(address)
  const data = await aptosGraphql<{ current_delegator_balances: DelegatorBalanceRow[] }>(DELEGATIONS_QUERY, {
    delegator,
  })
  if (!data || !Array.isArray(data.current_delegator_balances)) return null

  // One pool yields up to two rows, one per share table (active_shares and
  // inactive_shares), so collapse them into a single position per pool.
  const byPool = new Map<string, DelegatorBalanceRow[]>()
  for (const row of data.current_delegator_balances) {
    const pool = normalizeAptosAddress(row.pool_address)
    const existing = byPool.get(pool)
    if (existing) existing.push(row)
    else byPool.set(pool, [row])
  }
  if (byPool.size === 0) return []

  const pools = [...byPool.keys()]
  const stakes = await stakeForPools(pools, delegator)

  return pools.map(pool => {
    const rows = byPool.get(pool) ?? []
    const activeRow = rows.find(r => r.pool_type === "active_shares") ?? null
    const inactiveRow = rows.find(r => r.pool_type === "inactive_shares") ?? null
    const commission = (activeRow ?? inactiveRow)?.current_pool_balance?.operator_commission_percentage
    const commissionBps = commission === null || commission === undefined ? null : Number(commission)
    const lastVersion = rows
      .map(r => rawAmount(r.last_transaction_version))
      .sort((a, b) => (BigInt(a) > BigInt(b) ? -1 : 1))[0]
    const stake = stakes.get(pool) ?? null

    return {
      poolAddress: pool,
      activeOctas: stake?.activeOctas ?? null,
      inactiveOctas: stake?.inactiveOctas ?? null,
      pendingInactiveOctas: stake?.pendingInactiveOctas ?? null,
      amountsSource: stake && stake.activeOctas !== null ? ("chain" as const) : ("unavailable" as const),
      activeShares: shareAmount(activeRow?.shares),
      inactiveShares: shareAmount(inactiveRow?.shares),
      operatorCommissionBps: commissionBps !== null && Number.isFinite(commissionBps) ? commissionBps : null,
      lastTransactionVersion: lastVersion ?? null,
    }
  })
}

export interface AptosStakingActivity {
  /** Full Move event type, e.g. 0x1::delegation_pool::AddStake. */
  eventType: string
  /** Short action name: AddStake, UnlockStake, WithdrawStake, ReactivateStake, DistributeCommission. */
  action: string
  /** Octas moved by the event. */
  amount: string
  poolAddress: string
  version: string
  eventIndex: string
  /** ISO timestamp. null when the version to timestamp lookup failed, never a guess. */
  timestamp: string | null
}

interface StakingActivityRow {
  amount: number | string
  event_type: string
  pool_address: string
  transaction_version: number | string
  event_index: number | string
}

const ACTIVITY_QUERY = `query StakingActivity($delegator: String!, $limit: Int!) {
  delegated_staking_activities(
    where: { delegator_address: { _eq: $delegator } }
    order_by: [{ transaction_version: desc }, { event_index: desc }]
    limit: $limit
  ) {
    amount
    event_type
    pool_address
    transaction_version
    event_index
  }
}`

const ACTIVITY_TIMESTAMP_QUERY = `query StakingActivityTimes($versions: [bigint!]) {
  user_transactions(where: { version: { _in: $versions } }) {
    version
    timestamp
  }
}`

/** The indexer stores the fully qualified event type, but users think in verbs, so expose the trailing name. */
function actionFromEventType(eventType: string): string {
  const last = eventType.split("::").pop() ?? eventType
  return last.replace(/Event$/, "")
}

/**
 * delegated_staking_activities carries no timestamp column, only the
 * transaction version, so the times come from a second lookup against
 * user_transactions. That lookup failing must not sink the whole answer: the
 * events themselves are still true, so timestamps degrade to null.
 */
async function timestampsForVersions(versions: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (versions.length === 0) return out
  const data = await aptosGraphql<{ user_transactions: { version: number | string; timestamp: string }[] }>(
    ACTIVITY_TIMESTAMP_QUERY,
    { versions },
  )
  for (const row of data?.user_transactions ?? []) {
    out.set(rawAmount(row.version), row.timestamp)
  }
  return out
}

/**
 * Recent delegated staking events for a wallet, newest first.
 *
 * This is the history behind "why have my rewards not changed?": an UnlockStake
 * with no matching WithdrawStake, or an AddStake made mid lockup cycle, both
 * explain a balance that looks stuck.
 *
 * Returns null when the indexer lookup failed, [] when the wallet has never
 * touched delegated staking.
 */
export async function getAptosStakingActivity(
  address: string,
  limit = 15,
): Promise<AptosStakingActivity[] | null> {
  const delegator = normalizeAptosAddress(address)
  const data = await aptosGraphql<{ delegated_staking_activities: StakingActivityRow[] }>(ACTIVITY_QUERY, {
    delegator,
    limit: Math.min(100, Math.max(1, limit)),
  })
  if (!data || !Array.isArray(data.delegated_staking_activities)) return null

  const rows = data.delegated_staking_activities
  const versions = [...new Set(rows.map(r => rawAmount(r.transaction_version)))]
  const times = await timestampsForVersions(versions)

  return rows.map(r => {
    const version = rawAmount(r.transaction_version)
    return {
      eventType: r.event_type,
      action: actionFromEventType(r.event_type),
      amount: rawAmount(r.amount),
      poolAddress: normalizeAptosAddress(r.pool_address),
      version,
      eventIndex: rawAmount(r.event_index),
      timestamp: times.get(version) ?? null,
    }
  })
}

export interface AptosPoolLockup {
  poolAddress: string
  /** False when the chain reports no stake pool at this address. */
  poolExists: boolean
  /** Unix seconds at which the current lockup cycle ends. */
  lockupExpirySecs: string | null
  /** The same instant as an ISO timestamp. */
  lockupExpiry: string | null
  /** Seconds until the lockup ends, 0 once it has elapsed. */
  secondsRemaining: number | null
  /** True once the lockup cycle has ended, so unlocked stake can move to inactive. */
  lockupElapsed: boolean | null
  /** The chain's explanation when poolExists is false. */
  reason: string | null
}

/**
 * When the current lockup cycle for a pool ends, via 0x1::stake::get_lockup_secs.
 *
 * This is the literal answer to "when can I unstake". Note what it does and
 * does not mean: unlocking is a two step process, so funds unlocked during this
 * cycle become withdrawable at this expiry, and stake unlocked AFTER it waits
 * for the following cycle. Callers must not present this as a countdown for a
 * request that has not been made yet.
 *
 * Returns null only when the node could not be reached, so an outage is never
 * reported as "there is no such pool".
 */
export async function getAptosPoolLockup(poolAddress: string): Promise<AptosPoolLockup | null> {
  const pool = normalizeAptosAddress(poolAddress)
  const res = await viewFunctionResult("0x1::stake::get_lockup_secs", [], [pool])

  if (!res.ok) {
    if (res.kind === "aborted") {
      return {
        poolAddress: pool,
        poolExists: !isMissingPool(res.message),
        lockupExpirySecs: null,
        lockupExpiry: null,
        secondsRemaining: null,
        lockupElapsed: null,
        reason: res.message,
      }
    }
    return null
  }

  const secs = asOctaString(res.data[0])
  if (secs === null) return null
  const remaining = Math.max(0, Math.round(Number(secs) - Date.now() / 1000))

  return {
    poolAddress: pool,
    poolExists: true,
    lockupExpirySecs: secs,
    lockupExpiry: secondsToIso(secs),
    secondsRemaining: Number.isFinite(remaining) ? remaining : null,
    lockupElapsed: remaining === 0,
    reason: null,
  }
}
