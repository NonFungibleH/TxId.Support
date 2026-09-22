import { createServiceClient } from "@/lib/supabase/server"
import type { Arm, CohortRow, CohortUpdate } from "./cohort"

/**
 * activation_wallets, read and written with the service client.
 *
 * A MISSING TABLE IS NOT AN ERROR HERE. Migrations in this repo have sat
 * unapplied for weeks, and the readiness check must keep working for the user
 * in front of it whether or not the measurement behind it is recording. So the
 * table's absence reads as "no row", and every write swallows it. Any other
 * database error is also swallowed: the record is a side effect of helping
 * someone, never a reason not to.
 */

// Not in the generated Database types until the migration is applied and the
// types are regenerated, so the client is used untyped for this one table.
type Untyped = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

const TABLE = "activation_wallets"
const COLUMNS =
  "wallet_address, arm, status, first_seen_at, activated_at, last_checked_at, prompted_at, opened_at, dismissed_at"

export function walletKey(address: string): string {
  return address.trim().toLowerCase()
}

/** The wallet's row, created on first sight. Null when the table is not there or the database did not answer. */
export async function loadOrCreate(
  projectId: string,
  address: string,
  chain: string,
  arm: Arm,
): Promise<CohortRow | null> {
  const db = createServiceClient() as unknown as Untyped
  const wallet = walletKey(address)
  try {
    // ignoreDuplicates: an existing row keeps its first_seen_at and its arm.
    // The arm is deterministic anyway, but a changed holdout share must not
    // move a wallet between groups halfway through its window.
    await db.from(TABLE).upsert(
      { project_id: projectId, wallet_address: wallet, chain, arm },
      { onConflict: "project_id,wallet_address", ignoreDuplicates: true },
    )
    const { data, error } = await db.from(TABLE).select(COLUMNS).eq("project_id", projectId).eq("wallet_address", wallet).maybeSingle()
    if (error || !data) return null
    return data as CohortRow
  } catch {
    return null
  }
}

export async function applyUpdate(projectId: string, address: string, update: CohortUpdate): Promise<void> {
  if (Object.keys(update).length === 0) return
  const db = createServiceClient() as unknown as Untyped
  try {
    await db.from(TABLE).update(update).eq("project_id", projectId).eq("wallet_address", walletKey(address))
  } catch { /* a side effect, never a failure */ }
}

export type ActivationEvent = "prompted" | "opened" | "dismissed" | "failure_seen"

/** Stamps the FIRST time only, so a user who opens it five times is one open. */
export async function recordEvent(projectId: string, address: string, event: ActivationEvent): Promise<void> {
  const db = createServiceClient() as unknown as Untyped
  const column = `${event === "failure_seen" ? "failure_seen" : event}_at`
  try {
    await db.from(TABLE)
      .update({ [column]: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("wallet_address", walletKey(address))
      .is(column, null)
  } catch { /* a side effect, never a failure */ }
}

/** Every row for a project, for the dashboard. Null means we could not read, which the page says. */
export async function loadCohort(projectId: string): Promise<CohortRow[] | null> {
  const db = createServiceClient() as unknown as Untyped
  try {
    const { data, error } = await db.from(TABLE).select(COLUMNS).eq("project_id", projectId).limit(20_000)
    if (error) return null
    return (data ?? []) as CohortRow[]
  } catch {
    return null
  }
}
