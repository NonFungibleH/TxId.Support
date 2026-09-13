import { createServiceClient } from "@/lib/supabase/server"
import { currentWallet, customerForWallet, findByEmail, type IdentityRecord } from "@/lib/identity/store"
import type { ProjectConfig } from "@/lib/types/config"
import { fundsAtRisk, outcomeOf, toCaseRow, toCaseView, type ResolutionRow } from "./view"
import type {
  CaseRow, CaseView, CauseGroup, ConsoleRead, CustomerSummary, CustomerView, OverviewFigures, TrailEvent,
} from "./types"
import type { ConsoleSetup } from "./setup"

/**
 * The Console's reads, against the resolutions and identity tables.
 *
 * TWO-VALUED AT THE TOP. Every read returns `ok` or `unavailable`, and an
 * empty list is only ever `ok`. The first version degraded every error to an
 * empty array so the page would not 500 before the migration was applied.
 * That kept the 500 out and put something worse in: an inbox that read
 * "nothing to do" during an outage. `unavailable` keeps the 500 out too, and a
 * page can say what actually happened.
 *
 * Shapes are the ones in ./types, produced through ./view, which is the same
 * boundary the demo fixtures produce. A page swaps from demo to live by
 * changing which module it calls, and no component can tell.
 */

const SELECT =
  "id, created_at, chain, tx_hash, protocol_address, txid_code, category, status, custody, next_action_owner, retryable, basis, summary, customer_ref, wallet, raw_status, chain_state_at, evidence"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any

/**
 * Run one read, turning every way it can fail into `unavailable`. The client
 * constructor, the query and a thrown error all end up here rather than in a
 * page, and none of them is allowed to look like an answer.
 */
async function read<T>(fn: (db: Db) => Promise<{ data: unknown; error: { message?: string } | null }>, map: (data: unknown) => T): Promise<ConsoleRead<T>> {
  let db: Db
  try {
    db = createServiceClient()
  } catch (e) {
    return { kind: "unavailable", reason: e instanceof Error ? e.message : "the database client could not be created" }
  }
  try {
    const { data, error } = await fn(db)
    if (error) return { kind: "unavailable", reason: error.message ?? "the read failed" }
    return { kind: "ok", value: map(data) }
  } catch (e) {
    return { kind: "unavailable", reason: e instanceof Error ? e.message : "the read threw" }
  }
}

const rows = (data: unknown): ResolutionRow[] => (Array.isArray(data) ? (data as ResolutionRow[]) : [])

function summaryOf(i: IdentityRecord): CustomerSummary {
  return {
    id: i.customerRef,
    label: i.displayName ?? i.email ?? i.customerRef,
    email: i.email,
    wallet: i.wallet,
    chain: i.chain,
    since: i.createdAt,
  }
}

/**
 * Identities for a set of rows, in one query rather than one per row. Keyed by
 * customer_ref AND by lower-cased wallet, so a row written before its wallet
 * was mapped still resolves to the person.
 */
async function identitiesFor(projectId: string, list: ResolutionRow[]): Promise<Map<string, CustomerSummary>> {
  const refs = [...new Set(list.map(r => r.customer_ref).filter((x): x is string => !!x))]
  const wallets = [...new Set(list.map(r => r.wallet?.toLowerCase()).filter((x): x is string => !!x))]
  const out = new Map<string, CustomerSummary>()
  if (refs.length === 0 && wallets.length === 0) return out
  const r = await read(
    db => db.from("customer_identities")
      .select("customer_ref, email, display_name, wallet, chain, source, created_at")
      .eq("project_id", projectId)
      .is("superseded_at", null)
      .limit(1000),
    d => (Array.isArray(d) ? d : []) as Array<{ customer_ref: string; email: string | null; display_name: string | null; wallet: string; chain: string; source: IdentityRecord["source"]; created_at: string }>,
  )
  if (r.kind !== "ok") return out
  for (const row of r.value) {
    const s = summaryOf({ customerRef: row.customer_ref, email: row.email, displayName: row.display_name, wallet: row.wallet, chain: row.chain, source: row.source, createdAt: row.created_at })
    out.set(`ref:${row.customer_ref}`, s)
    out.set(`wallet:${row.wallet.toLowerCase()}`, s)
  }
  return out
}

const identityOf = (ids: Map<string, CustomerSummary>, row: ResolutionRow): CustomerSummary | null =>
  (row.customer_ref && ids.get(`ref:${row.customer_ref}`)) || (row.wallet && ids.get(`wallet:${row.wallet.toLowerCase()}`)) || null

/** Cases, newest first, optionally narrowed to one cause or one status. */
export async function listCases(
  projectId: string,
  opts: { cause?: string; status?: string; limit?: number } = {},
): Promise<ConsoleRead<CaseRow[]>> {
  const r = await read(db => {
    let q = db.from("resolutions").select(SELECT).eq("project_id", projectId).order("created_at", { ascending: false }).limit(opts.limit ?? 100)
    if (opts.cause) q = q.eq("txid_code", opts.cause)
    return q
  }, rows)
  if (r.kind !== "ok") return r
  const ids = await identitiesFor(projectId, r.value)
  let cases = r.value.map(row => toCaseRow(row, identityOf(ids, row)))
  // "Open" is failures we could establish. An indeterminate answer is not one
  // of those and must not be counted as work the customer owes a reply on.
  if (opts.status === "open") cases = cases.filter(c => c.outcome === "failed")
  if (opts.status === "waiting") cases = cases.filter(c => c.outcome === "pending")
  if (opts.status === "unknown") cases = cases.filter(c => c.outcome === "indeterminate")
  return { kind: "ok", value: cases }
}

/** One case in full, with its access trail. `null` is a finding: no such case. */
export async function caseViewById(projectId: string, id: string): Promise<ConsoleRead<CaseView | null>> {
  const r = await read(
    db => db.from("resolutions").select(SELECT).eq("project_id", projectId).eq("id", id).maybeSingle(),
    d => (d ? (d as ResolutionRow) : null),
  )
  if (r.kind !== "ok") return r
  if (!r.value) return { kind: "ok", value: null }
  const row = r.value
  const [ids, trail] = await Promise.all([identitiesFor(projectId, [row]), caseAccessTrail(projectId, id)])
  return { kind: "ok", value: toCaseView(row, identityOf(ids, row), trail.kind === "ok" ? trail.value : []) }
}

/** The case for a transaction hash, if we have resolved it. */
export async function caseIdByHash(projectId: string, hash: string): Promise<ConsoleRead<string | null>> {
  return read(
    db => db.from("resolutions").select("id").eq("project_id", projectId).ilike("tx_hash", hash).order("created_at", { ascending: false }).limit(1),
    d => ((Array.isArray(d) && d[0]) ? (d[0] as { id: string }).id : null),
  )
}

/** Everything one customer has hit, newest first, successes included. */
export async function customerCases(projectId: string, customerRef: string): Promise<ConsoleRead<CaseRow[]>> {
  const r = await read(
    db => db.from("resolutions").select(SELECT).eq("project_id", projectId).eq("customer_ref", customerRef).order("created_at", { ascending: false }).limit(200),
    rows,
  )
  if (r.kind !== "ok") return r
  const ids = await identitiesFor(projectId, r.value)
  return { kind: "ok", value: r.value.map(row => toCaseRow(row, identityOf(ids, row))) }
}

/** The same, for a wallet nobody has mapped yet. */
async function walletCases(projectId: string, wallet: string): Promise<ConsoleRead<CaseRow[]>> {
  const r = await read(
    db => db.from("resolutions").select(SELECT).eq("project_id", projectId).ilike("wallet", wallet).order("created_at", { ascending: false }).limit(200),
    rows,
  )
  if (r.kind !== "ok") return r
  return { kind: "ok", value: r.value.map(row => toCaseRow(row, null)) }
}

/**
 * One customer, by their reference or by a wallet. `null` is a finding: nothing
 * is known about them. A mapped customer's timeline is by reference; an
 * unmapped wallet's is by address, and it is shown as the address, because
 * that is what we know.
 */
export async function customerView(projectId: string, idOrWallet: string): Promise<ConsoleRead<CustomerView | null>> {
  const byRef = await currentWallet(projectId, idOrWallet)
  const byWallet = byRef ? null : await customerForWallet(projectId, idOrWallet)
  const identity = byRef ?? byWallet
  if (identity) {
    const timeline = await customerCases(projectId, identity.customerRef)
    if (timeline.kind !== "ok") return timeline
    return { kind: "ok", value: { ...summaryOf(identity), timeline: timeline.value } }
  }
  if (!/^0x[0-9a-fA-F]{40,64}$/.test(idOrWallet)) return { kind: "ok", value: null }
  const timeline = await walletCases(projectId, idOrWallet)
  if (timeline.kind !== "ok") return timeline
  if (timeline.value.length === 0) return { kind: "ok", value: null }
  const first = timeline.value[0]!
  return {
    kind: "ok",
    value: { id: idOrWallet, label: first.customerLabel, email: null, wallet: idOrWallet, chain: first.chain, since: null, timeline: timeline.value },
  }
}

export interface CustomerListItem extends CustomerSummary {
  open: number
}

/**
 * Everyone who has interacted with the contracts: mapped customers, plus the
 * wallets we hold cases for but nobody has mapped. Shown by default with the
 * search as a filter on top, the way every CRM a support team uses works.
 */
export async function listCustomers(projectId: string, q?: string): Promise<ConsoleRead<CustomerListItem[]>> {
  const cases = await read(
    db => db.from("resolutions").select("customer_ref, wallet, chain, status").eq("project_id", projectId).order("created_at", { ascending: false }).limit(2000),
    d => (Array.isArray(d) ? d : []) as Array<{ customer_ref: string | null; wallet: string | null; chain: string | null; status: string }>,
  )
  if (cases.kind !== "ok") return cases
  const ids = await identitiesFor(projectId, cases.value.map(c => ({ ...c, id: "", created_at: "", tx_hash: null, protocol_address: null, txid_code: "", category: "", custody: "", next_action_owner: "", retryable: null, basis: "", summary: null, raw_status: null, evidence: [] })))

  const people = new Map<string, CustomerListItem>()
  // Every mapped customer appears, cases or not.
  for (const [key, s] of ids) {
    if (!key.startsWith("ref:")) continue
    people.set(s.id, { ...s, open: 0 })
  }
  for (const c of cases.value) {
    const mapped = (c.customer_ref && ids.get(`ref:${c.customer_ref}`)) || (c.wallet && ids.get(`wallet:${c.wallet.toLowerCase()}`)) || null
    const id = mapped?.id ?? c.wallet
    if (!id) continue
    if (!people.has(id)) {
      const w = c.wallet ?? id
      people.set(id, { id, label: w.length > 18 ? `${w.slice(0, 10)}…${w.slice(-6)}` : w, email: null, wallet: c.wallet, chain: c.chain, since: null, open: 0 })
    }
    if (outcomeOf(c.status) !== "succeeded") people.get(id)!.open += 1
  }

  const query = (q ?? "").trim().toLowerCase()
  const all = [...people.values()].sort((a, b) => b.open - a.open || a.label.localeCompare(b.label))
  if (!query) return { kind: "ok", value: all }
  return {
    kind: "ok",
    value: all.filter(c =>
      c.label.toLowerCase().includes(query) ||
      (c.email ?? "").toLowerCase().includes(query) ||
      (c.wallet ?? "").toLowerCase().includes(query) ||
      c.id.toLowerCase() === query,
    ),
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
export async function causeGroups(projectId: string, sinceDays = 7): Promise<ConsoleRead<CauseGroup[]>> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
  const r = await read(
    db => db.from("resolutions")
      .select("txid_code, category, summary, custody, status, next_action_owner, created_at, customer_ref, wallet")
      .eq("project_id", projectId)
      .gte("created_at", since)
      .limit(2000),
    d => (Array.isArray(d) ? d : []) as Array<Pick<ResolutionRow, "txid_code" | "category" | "summary" | "custody" | "status" | "next_action_owner" | "created_at" | "customer_ref" | "wallet">>,
  )
  if (r.kind !== "ok") return r

  const groups = new Map<string, CauseGroup & { people: Set<string> }>()
  for (const row of r.value) {
    const outcome = outcomeOf(row.status)
    // A success is not a cause of anything.
    if (outcome === "succeeded") continue
    const who = row.customer_ref ?? row.wallet ?? "unknown"
    const existing = groups.get(row.txid_code)
    if (existing) {
      existing.people.add(who)
      if (row.created_at < existing.firstSeen) existing.firstSeen = row.created_at
      // Any one case with funds at stake makes the cause one.
      existing.fundsAtRisk = existing.fundsAtRisk || fundsAtRisk(outcome, row.custody)
      continue
    }
    groups.set(row.txid_code, {
      code: row.txid_code,
      category: row.category,
      title: row.summary ?? `${row.category} failure`,
      affected: 0,
      fundsAtRisk: fundsAtRisk(outcome, row.custody),
      // Trend needs a prior window to compare against; until that is built,
      // saying "steady" is honest and inventing a direction is not.
      trend: "flat",
      owner: row.next_action_owner,
      firstSeen: row.created_at,
      sample: who,
      people: new Set([who]),
    })
  }
  return {
    kind: "ok",
    value: [...groups.values()]
      .map(({ people, ...g }) => ({ ...g, affected: people.size }))
      .sort((a, b) => Number(b.fundsAtRisk) - Number(a.fundsAtRisk) || b.affected - a.affected),
  }
}

/** How many resolutions rest on each basis, over the same window as the causes. */
export async function basisCounts(projectId: string, sinceDays = 7): Promise<ConsoleRead<Record<string, number>>> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
  return read(
    db => db.from("resolutions").select("basis").eq("project_id", projectId).gte("created_at", since).limit(5000),
    d => {
      const out: Record<string, number> = {}
      for (const row of (Array.isArray(d) ? d : []) as { basis: string }[]) out[row.basis] = (out[row.basis] ?? 0) + 1
      return out
    },
  )
}

/** The overview figures, from the same reads the other pages use so no two pages disagree. */
export async function overview(projectId: string): Promise<ConsoleRead<OverviewFigures>> {
  const [cases, causes, basis] = await Promise.all([listCases(projectId, { limit: 200 }), causeGroups(projectId), basisCounts(projectId)])
  if (cases.kind !== "ok") return cases
  if (causes.kind !== "ok") return causes
  if (basis.kind !== "ok") return basis
  const total = Object.values(basis.value).reduce((n, v) => n + v, 0)
  return {
    kind: "ok",
    value: {
      affected: causes.value.reduce((n, c) => n + c.affected, 0),
      causes: causes.value.length,
      unresolved: cases.value.filter(c => c.outcome === "failed" || c.outcome === "pending").length,
      fundsAtRiskCauses: causes.value.filter(c => c.fundsAtRisk).length,
      verifiedShare: total ? Math.round(((basis.value.verified ?? 0) / total) * 100) : 0,
      topCauses: causes.value.slice(0, 3),
      recent: cases.value.slice(0, 4).map(c => ({ id: c.id, who: c.customerLabel, intent: c.intent, at: c.at, outcome: c.outcome, code: c.code })),
    },
  }
}

const EVENT: Record<string, string> = {
  view: "Case viewed",
  reply: "Reply copied, SHA-256 recorded",
  export: "Case record exported",
  erase: "Record erased",
}

/**
 * Who has touched this case. Read from the append-only access log, so the
 * trail a buyer is paying for is the real one.
 */
export async function caseAccessTrail(projectId: string, caseId: string): Promise<ConsoleRead<TrailEvent[]>> {
  return read(
    db => db.from("case_access_log")
      .select("created_at, actor, action, detail")
      .eq("project_id", projectId)
      .eq("detail->>entity", `case:${caseId}`)
      .order("created_at", { ascending: true })
      .limit(200),
    d => ((Array.isArray(d) ? d : []) as { created_at: string; actor: string; action: string }[]).map(e => ({
      at: e.created_at,
      // A Clerk user id, shortened. Mapping it to a name is a Clerk call per
      // actor and belongs in the Team page's helper when it is needed here.
      actor: e.actor.length > 14 ? `user …${e.actor.slice(-6)}` : e.actor,
      event: EVENT[e.action] ?? e.action,
    })),
  )
}

/**
 * Where a search should LAND. An email, wallet, reference or hash that
 * identifies one thing goes straight to it; anything else returns null and the
 * caller shows the filtered directory.
 */
export async function resolveSearchTarget(projectId: string, q: string): Promise<string | null> {
  const query = q.trim()
  if (!query) return null
  if (query.includes("@")) {
    const hit = await findByEmail(projectId, query)
    return hit ? `/customers/${encodeURIComponent(hit.customerRef)}` : null
  }
  if (/^0x[0-9a-fA-F]{64}$/.test(query)) {
    const c = await caseIdByHash(projectId, query)
    if (c.kind === "ok" && c.value) return `/inbox/${c.value}`
  }
  if (/^0x[0-9a-fA-F]{40,64}$/.test(query)) {
    const hit = await customerForWallet(projectId, query)
    if (hit) return `/customers/${encodeURIComponent(hit.customerRef)}`
    const cases = await walletCases(projectId, query)
    if (cases.kind === "ok" && cases.value.length > 0) return `/customers/${query}`
    return null
  }
  const byRef = await currentWallet(projectId, query)
  return byRef ? `/customers/${encodeURIComponent(byRef.customerRef)}` : null
}

/**
 * Where this workspace is in setting the Console up, from what is actually
 * configured rather than from a stored checklist that can drift from it.
 */
export async function liveSetup(project: { id: string; config: ProjectConfig | null | undefined }): Promise<ConsoleSetup> {
  const contracts = project.config?.watchedContracts?.length ?? 0
  const [newest, verified] = await Promise.all([
    read(
      db => db.from("customer_identities").select("source").eq("project_id", project.id).is("superseded_at", null).order("created_at", { ascending: false }).limit(1),
      d => ((Array.isArray(d) && d[0]) ? (d[0] as { source: ConsoleSetup["identitySource"] }).source : "none"),
    ),
    read(
      db => db.from("case_access_log").select("created_at").eq("project_id", project.id).eq("detail->>surface", "console").eq("action", "view").order("created_at", { ascending: true }).limit(1),
      d => ((Array.isArray(d) && d[0]) ? (d[0] as { created_at: string }).created_at : null),
    ),
  ])
  return {
    contracts,
    identitySource: newest.kind === "ok" ? newest.value : "none",
    // No CRM connection exists yet. Saying so is the honest state of the step.
    crm: "none",
    verifiedLookupAt: verified.kind === "ok" ? verified.value : null,
  }
}
