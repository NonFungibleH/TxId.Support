import { auth, currentUser } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"

/**
 * Record a configuration change against the team member who made it.
 *
 * TWO RULES, BOTH LOAD-BEARING:
 *
 * 1. NEVER FAILS A WRITE. Auditing is a side effect of the real action. If the
 *    table is missing, or Clerk is slow, the user's change still lands. A
 *    product that refuses to save a webhook URL because its audit log is down
 *    is worse than one with a gap in the log.
 *
 * 2. NEVER STORES A SECRET. Record that a credential changed, never what it
 *    changed to. A log that accumulates every API token a customer has ever
 *    pasted is a bigger liability than the thing it was built to reassure
 *    people about.
 */

export interface AuditEntry {
  /** Dotted verb: "integration.saved", "key.rotated", "contract.added". */
  action: string
  /** Human-readable subject: "Slack", "Uniswap V3 Router". */
  target?: string
  projectId?: string | null
  orgId?: string | null
  /** Anything useful for reading the row later. Never a credential value. */
  metadata?: Record<string, unknown>
}

/**
 * Keys whose VALUES must never reach the log, whatever a caller passes. The
 * helper is called from many places, and one careless `metadata: patch` would
 * otherwise write a Jira token into the very table we point security reviewers
 * at. Belt and braces on top of callers being careful.
 */
const FORBIDDEN = /token|secret|key|password|webhookurl|apitoken|apikey|credential/i

function scrub(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!metadata) return {}
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(metadata)) {
    // The FACT of a change is the useful part, so keep the key and drop the value.
    out[k] = FORBIDDEN.test(k) ? "[redacted]" : v
  }
  return out
}

/**
 * What a value LOOKED like, for the log, in one short readable string.
 *
 * WHY THIS EXISTS: the log used to record only which keys changed, so four
 * saves of the same switch produced four identical rows reading "docsSync,
 * docsSync" and an auditor could not tell whether it had been turned on or
 * off, or what it had been before. A change history that cannot answer "what
 * did they actually do" is decoration.
 *
 * Never the value of a credential. A secret's presence is auditable, its
 * content is not, and that rule is what makes this table safe to show a
 * reviewer.
 */
export function describeValue(key: string, v: unknown): string {
  // A BOOLEAN CANNOT LEAK A SECRET, and redacting it actively misleads. The
  // pattern matches on the key name, so `allowUnrestrictedKey` (a toggle) was
  // logged as "set" and read like a credential had changed. Redaction applies
  // to values that could carry one.
  if (FORBIDDEN.test(key) && typeof v !== "boolean") {
    return v === null || v === undefined || v === "" ? "cleared" : "set"
  }
  if (v === null || v === undefined) return "not set"
  if (typeof v === "boolean") return v ? "on" : "off"
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return v === "" ? "empty" : v.length > 80 ? `${v.slice(0, 80)}…` : v
  if (Array.isArray(v)) return `${v.length} item${v.length === 1 ? "" : "s"}`
  if (typeof v === "object") {
    // Objects are configuration blocks (branding, integrations, beta). Naming
    // the keys inside says more than "object" and stays short.
    const keys = Object.keys(v as Record<string, unknown>)
    return keys.length ? `{ ${keys.slice(0, 6).join(", ")}${keys.length > 6 ? ", …" : ""} }` : "empty"
  }
  return String(v)
}

/** One field's before and after, as the log stores it. */
export interface FieldChange { field: string; from: string; to: string }

/**
 * Compare a config patch against what is already stored.
 *
 * Returns ONLY fields whose value actually moved. Debounced forms re-save the
 * same object on every keystroke, which is why the history filled with
 * identical rows seconds apart. A save that changed nothing is not a change,
 * and recording it buries the ones that were.
 */
export function diffConfig(
  before: Record<string, unknown>,
  patch: Record<string, unknown>,
): FieldChange[] {
  const out: FieldChange[] = []
  for (const key of Object.keys(patch)) {
    const a = before?.[key]
    const b = patch[key]
    try {
      if (JSON.stringify(a) === JSON.stringify(b)) continue
    } catch {
      // Unserialisable (a cycle): treat as changed rather than dropping it.
    }
    // WHICH KIND OF FIELD IS THIS, decided from the PAIR. A boolean cannot
    // carry a credential, but the previous value of a toggle being set for the
    // first time is `undefined`, which on its own looks like it might. Judging
    // from either side alone logged "cleared -> on", which is nonsense.
    const isToggle = typeof a === "boolean" || typeof b === "boolean"
    // NOT_A_SECRET skips the key-name redaction for a field we have just
    // established holds a boolean.
    const NOT_A_SECRET = ""
    const nameFor = isToggle ? NOT_A_SECRET : key
    out.push({ field: key, from: describeValue(nameFor, a), to: describeValue(nameFor, b) })
  }
  return out
}


/**
 * CALLERS MUST NOT `void` THIS. Use waitUntil.
 *
 * On Vercel the function can be frozen the moment its response is sent, so a
 * promise started and abandoned just before a return may never run. Every call
 * site was a bare `void`, which means the change history had holes nobody could
 * enumerate: for a table we point security reviewers at, "some entries may be
 * missing and we cannot tell you which" is worse than not having it.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    // NOTE: Clerk's orgId is a Clerk string id, not our internal organisations
    // UUID, so it deliberately is not read here. Callers that know the
    // internal id pass it; the rest rely on project_id, which is enough to
    // scope every query this table serves.
    const { userId } = await auth()
    if (!userId) return

    // Best-effort: an email makes the log readable, but its absence must not
    // stop the row being written.
    let actorEmail: string | null = null
    let actorName: string | null = null
    try {
      const user = await currentUser()
      actorEmail = user?.emailAddresses?.[0]?.emailAddress ?? null
      // The person's own name, as THEY entered it at sign-up. Never typed in
      // on their behalf by whoever invited them.
      actorName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || null
    } catch { /* ignore */ }

    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("audit_logs").insert({
      actor_id: userId,
      actor_email: actorEmail,
      action: entry.action,
      target: entry.target ?? null,
      project_id: entry.projectId ?? null,
      org_id: entry.orgId ?? null,
      // Carried in metadata rather than a new column: the table already exists
      // in production and this is not worth a migration. Never scrubbed, since
      // "actorName" is not credential-shaped.
      metadata: { ...scrub(entry.metadata), ...(actorName ? { actorName } : {}) },
    })
  } catch {
    // Deliberately silent. See rule 1.
  }
}

export interface AuditRow {
  id: string
  actorId: string
  actorEmail: string | null
  /**
   * WHY A NAME AND NOT JUST AN EMAIL: six months later a reviewer reads
   * "ops@protocol.xyz rotated the API key" and learns nothing. Shared and
   * role-based mailboxes are common on exactly the teams that get audited, and
   * a change history that cannot name a person is not much of a history.
   */
  actorName: string | null
  action: string
  target: string | null
  metadata: Record<string, unknown>
  createdAt: string
}

export async function listAudit(projectId: string, limit = 100): Promise<AuditRow[]> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("audit_logs")
    .select("id, actor_id, actor_email, action, target, metadata, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit)
  if (error) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(r => ({
    id: r.id,
    actorId: r.actor_id,
    actorEmail: r.actor_email ?? null,
    actorName: typeof r.metadata?.actorName === "string" ? r.metadata.actorName : null,
    action: r.action,
    target: r.target ?? null,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }))
}
