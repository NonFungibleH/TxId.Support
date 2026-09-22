import { ACTIVATION_HOLDOUT_MAX } from "@/lib/types/config"

/**
 * Measuring whether the readiness check works, honestly.
 *
 * A protocol will judge this feature by one number: do more new wallets reach
 * a first successful action with it than without it. That number is only worth
 * showing if it cannot flatter us, so three things are deliberate:
 *
 * 1. A HOLDOUT. A fixed share of new wallets never see it. Without a
 *    comparison group, a good month for the protocol reads as our win.
 *
 * 2. NEW MEANS PROVEN NEW. A wallet counts only when its full history was read
 *    and showed no earlier success. A wallet whose history could not be read
 *    in full stays pending and is left out, never assumed new: a returning
 *    user counted as a "new wallet that activated" inflates the rate. This
 *    biases the cohort toward lighter wallets, and the dashboard says so.
 *
 * 3. UNKNOWN IS NOT "DIDN'T". A wallet whose window closed without a check
 *    covering it is unconfirmed and left out, never counted as a failure to
 *    activate. And until both groups have enough known outcomes, there is no
 *    percentage at all.
 */

export const ACTIVATION_WINDOW_DAYS = 14
export const MIN_KNOWN_PER_ARM = 30
const DAY = 86_400_000

export type Arm = "shown" | "holdout"
export type CohortStatus = "pending" | "new" | "existing"

export interface CohortRow {
  wallet_address: string
  arm: Arm
  status: CohortStatus
  first_seen_at: string
  activated_at: string | null
  /** The last check whose history reached back to first seen. */
  last_checked_at: string | null
  prompted_at: string | null
  opened_at: string | null
  dismissed_at: string | null
}

/** Transactions from the wallet to the protocol's watched contracts, newest first. */
export type ProtocolHistory =
  | {
      kind: "ok"
      /** The read returned the wallet's whole history, not one page of it. */
      complete: boolean
      /** The oldest transaction in the page read, to any contract. Null for a wallet with none. */
      oldestAt: string | null
      /** `age` is computed by the chain package, so nothing here subtracts two clocks. */
      txs: { hash: string; at: string; success: boolean; reason?: string; age?: string | null }[]
    }
  | { kind: "unavailable" }
  | { kind: "unsupported" }

/**
 * FNV-1a. Not for security, only for a stable, well-spread bucket, so the same
 * wallet lands in the same group on every device and every visit.
 */
function bucket(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h % 100
}

export function assignArm(projectId: string, wallet: string, holdoutPct: number): Arm {
  const pct = Math.max(0, Math.min(ACTIVATION_HOLDOUT_MAX, Math.floor(Number(holdoutPct) || 0)))
  return bucket(`${projectId}:${wallet.toLowerCase()}`) < pct ? "holdout" : "shown"
}

export type CohortUpdate = Partial<Pick<CohortRow, "status" | "activated_at" | "last_checked_at">> & {
  activation_tx?: string
}

/** What a fresh read of the wallet's history changes about its row. Empty when it proves nothing. */
export function classifyWallet(
  row: Pick<CohortRow, "status" | "first_seen_at" | "activated_at">,
  h: ProtocolHistory,
  now: number,
): CohortUpdate {
  if (h.kind !== "ok") return {}
  const seen = Date.parse(row.first_seen_at)
  const update: CohortUpdate = {}

  // A success from before we first saw them is proof, whatever else the read
  // missed: they were already a user.
  if (row.status !== "existing" && h.txs.some(t => t.success && Date.parse(t.at) < seen)) {
    return { status: "existing" }
  }
  if (row.status === "existing") return {}

  let status = row.status
  if (status === "pending" && h.complete) status = update.status = "new"
  if (status !== "new") return update

  const covered = h.complete || (h.oldestAt !== null && Date.parse(h.oldestAt) <= seen)
  if (covered) update.last_checked_at = new Date(now).toISOString()

  if (!row.activated_at) {
    const first = h.txs
      .filter(t => t.success && Date.parse(t.at) >= seen)
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))[0]
    if (first) {
      update.activated_at = first.at
      update.activation_tx = first.hash
    }
  }
  return update
}

export interface ArmStats {
  /** Proven-new wallets in this group. */
  wallets: number
  activated: number
  notActivated: number
  inProgress: number
  unconfirmed: number
  /** activated ÷ (activated + notActivated), or null below MIN_KNOWN_PER_ARM. */
  rate: number | null
}

export interface CohortSummary {
  shown: ArmStats
  holdout: ArmStats
  comparable: boolean
  /** Shown minus holdout, in percentage points, with a 95% interval. */
  difference: { points: number; low: number; high: number } | null
  excluded: { existing: number; pending: number }
  funnel: { prompted: number; opened: number; dismissed: number }
}

function armStats(rows: CohortRow[], now: number): ArmStats & { known: number } {
  const s = { wallets: 0, activated: 0, notActivated: 0, inProgress: 0, unconfirmed: 0 }
  for (const r of rows) {
    s.wallets++
    const seen = Date.parse(r.first_seen_at)
    const end = seen + ACTIVATION_WINDOW_DAYS * DAY
    const act = r.activated_at ? Date.parse(r.activated_at) : null
    if (act !== null && act <= end) s.activated++
    else if (act !== null) s.notActivated++ // seen, and it was after the window
    else if (now < end) s.inProgress++
    else if (r.last_checked_at && Date.parse(r.last_checked_at) >= end) s.notActivated++
    else s.unconfirmed++
  }
  const known = s.activated + s.notActivated
  return { ...s, known, rate: known >= MIN_KNOWN_PER_ARM ? s.activated / known : null }
}

export function summarizeCohort(rows: CohortRow[], now: number): CohortSummary {
  const cohort = rows.filter(r => r.status === "new")
  const shownFull = armStats(cohort.filter(r => r.arm === "shown"), now)
  const holdFull = armStats(cohort.filter(r => r.arm === "holdout"), now)
  const { known: kS, ...shown } = shownFull
  const { known: kH, ...holdout } = holdFull

  const comparable = shown.rate !== null && holdout.rate !== null
  let difference: CohortSummary["difference"] = null
  if (comparable) {
    const p1 = shown.rate!, p2 = holdout.rate!
    const se = Math.sqrt((p1 * (1 - p1)) / kS + (p2 * (1 - p2)) / kH)
    const d = (p1 - p2) * 100
    difference = { points: d, low: d - 1.96 * se * 100, high: d + 1.96 * se * 100 }
  }

  const shownRows = cohort.filter(r => r.arm === "shown")
  return {
    shown,
    holdout,
    comparable,
    difference,
    excluded: {
      existing: rows.filter(r => r.status === "existing").length,
      pending: rows.filter(r => r.status === "pending").length,
    },
    funnel: {
      prompted: shownRows.filter(r => r.prompted_at).length,
      opened: shownRows.filter(r => r.opened_at).length,
      dismissed: shownRows.filter(r => r.dismissed_at).length,
    },
  }
}
