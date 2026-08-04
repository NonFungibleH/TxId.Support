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
    try {
      const user = await currentUser()
      actorEmail = user?.emailAddresses?.[0]?.emailAddress ?? null
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
      metadata: scrub(entry.metadata),
    })
  } catch {
    // Deliberately silent. See rule 1.
  }
}

export interface AuditRow {
  id: string
  actorId: string
  actorEmail: string | null
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
    action: r.action,
    target: r.target ?? null,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    createdAt: r.created_at,
  }))
}
