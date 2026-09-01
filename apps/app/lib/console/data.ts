import { createServiceClient } from "@/lib/supabase/server"
import type { CaseRow, CauseGroup } from "./fixtures"

/**
 * The Console's reads, against the resolutions table.
 *
 * Shapes deliberately MATCH the fixtures, so a page swaps from demo data to
 * live data by changing an import rather than being rewritten. That is also
 * what keeps the review copy at /console-demo honest: it renders the same
 * components against the same shapes.
 *
 * Every function degrades to empty rather than throwing. Before the migration
 * is applied the table does not exist, and a console that 500s is worse than
 * one that says it has nothing yet.
 */
interface ResolutionRow {
  id: string
  created_at: string
  chain: string | null
  tx_hash: string | null
  protocol_address: string | null
  txid_code: string
  category: string
  status: string
  custody: string
  next_action_owner: string
  retryable: string | null
  basis: string
  summary: string | null
  customer_ref: string | null
  wallet: string | null
  raw_status: string | null
  evidence: unknown
}

const SELECT =
  "id, created_at, chain, tx_hash, protocol_address, txid_code, category, status, custody, next_action_owner, retryable, basis, summary, customer_ref, wallet, raw_status, evidence"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return createServiceClient() as any
  } catch {
    return null
  }
}

/** A status the interface can show, from the Resolution's own vocabulary. */
function outcomeOf(status: string): "failed" | "pending" | "succeeded" {
  if (status === "succeeded" || status === "succeeded_intent_unmet") return "succeeded"
  if (status === "pending" || status === "not_mined") return "pending"
  return "failed"
}

/** Cases, newest first, optionally narrowed to one cause or one status. */
export async function listCases(
  projectId: string,
  opts: { cause?: string; status?: string; limit?: number } = {},
): Promise<CaseRow[]> {
  const client = db()
  if (!client) return []
  try {
    let q = client
      .from("resolutions")
      .select(SELECT)
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(opts.limit ?? 100)
    if (opts.cause) q = q.eq("txid_code", opts.cause)
    const { data, error } = await q
    if (error || !data) return []

    let rows = (data as ResolutionRow[]).map(toCaseRow)
    if (opts.status === "open") rows = rows.filter(r => r.outcome === "failed")
    if (opts.status === "waiting") rows = rows.filter(r => r.outcome === "pending")
    return rows
  } catch {
    return []
  }
}

function toCaseRow(r: ResolutionRow): CaseRow {
  return {
    id: r.id,
    customerId: r.customer_ref ?? r.wallet ?? "unknown",
    // Falls back to the wallet: a case with no mapped customer must still be
    // readable, and showing the address is honest about what we know.
    customerLabel: r.customer_ref ?? (r.wallet ? `${r.wallet.slice(0, 10)}…` : "Unknown wallet"),
    customerEmail: "",
    intent: r.summary ?? "Transaction failed",
    at: r.created_at,
    outcome: outcomeOf(r.status),
    chain: r.chain ?? "unknown",
    code: r.txid_code,
    category: r.category,
    basis: (r.basis as CaseRow["basis"]) ?? "indeterminate",
    fundsAtRisk: r.custody !== "funds_with_user" && r.custody !== "no_movement",
  }
}

/** One case, by its row id. */
export async function caseRowById(projectId: string, id: string): Promise<ResolutionRow | null> {
  const client = db()
  if (!client) return null
  try {
    const { data, error } = await client
      .from("resolutions")
      .select(SELECT)
      .eq("project_id", projectId)
      .eq("id", id)
      .maybeSingle()
    if (error || !data) return null
    return data as ResolutionRow
  } catch {
    return null
  }
}

/** Everything one customer has hit, newest first. */
export async function customerCases(projectId: string, customerRef: string): Promise<CaseRow[]> {
  const client = db()
  if (!client) return []
  try {
    const { data, error } = await client
      .from("resolutions")
      .select(SELECT)
      .eq("project_id", projectId)
      .eq("customer_ref", customerRef)
      .order("created_at", { ascending: false })
      .limit(200)
    if (error || !data) return []
    return (data as ResolutionRow[]).map(toCaseRow)
  } catch {
    return []
  }
}

/**
 * Failures grouped by cause: the queue is a list of causes, never of tickets.
 *
 * Grouped in application code rather than SQL on purpose. PostgREST cannot
 * express GROUP BY without a database function, and adding one for a read this
 * size is a migration to maintain for no gain. Revisit at volume, where a
 * materialised view is the answer rather than a cleverer query.
 */
export async function causeGroups(projectId: string, sinceDays = 7): Promise<CauseGroup[]> {
  const client = db()
  if (!client) return []
  try {
    const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
    const { data, error } = await client
      .from("resolutions")
      .select("txid_code, category, summary, custody, next_action_owner, created_at, customer_ref, wallet")
      .eq("project_id", projectId)
      .gte("created_at", since)
      .limit(2000)
    if (error || !data) return []

    const groups = new Map<string, CauseGroup & { people: Set<string> }>()
    for (const row of data as ResolutionRow[]) {
      const existing = groups.get(row.txid_code)
      const who = row.customer_ref ?? row.wallet ?? "unknown"
      if (existing) {
        existing.people.add(who)
        if (row.created_at < existing.firstSeen) existing.firstSeen = row.created_at
        continue
      }
      groups.set(row.txid_code, {
        code: row.txid_code,
        category: row.category,
        title: row.summary ?? `${row.category} failure`,
        affected: 0,
        // Anything not sitting with the user is money we cannot see the end of.
        fundsAtRisk: row.custody !== "funds_with_user" && row.custody !== "no_movement",
        // Trend needs a prior window to compare against; until that is built,
        // saying "steady" is honest and inventing a direction is not.
        trend: "flat",
        owner: row.next_action_owner,
        firstSeen: row.created_at,
        sample: who,
        people: new Set([who]),
      })
    }
    return [...groups.values()]
      .map(({ people, ...g }) => ({ ...g, affected: people.size }))
      .sort((a, b) => Number(b.fundsAtRisk) - Number(a.fundsAtRisk) || b.affected - a.affected)
  } catch {
    return []
  }
}
