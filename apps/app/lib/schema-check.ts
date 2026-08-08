import { createServiceClient } from "@/lib/supabase/server"

/**
 * Which tables production is actually missing.
 *
 * WHY THIS EXISTS. Production has run ahead of its migrations at least three
 * times, and every symptom was silent and misleading:
 *
 *  - `webhook_logs` absent, so `dispatchEscalation` threw and the Tickets page
 *    was permanently empty. It read as "nobody has escalated anything".
 *  - `token_usage` and `action_events` absent for weeks with nothing to show
 *    for it.
 *  - An unknown column on the conversation upsert meant NO conversation was
 *    recorded at all, which read as "the widget is not being used".
 *
 * In each case the code was correct, the deploy was green, and the product
 * quietly did less than it claimed. The check itself takes one query and would
 * have named the cause in seconds.
 *
 * DELIBERATELY NOT A STARTUP CRASH. Refusing to boot because an optional table
 * is missing would take a working product down to protect a log. This reports;
 * the admin console shows it; nothing changes behaviour.
 */

/** Every table the application writes to, with what breaks without it. */
export const EXPECTED_TABLES: Record<string, string> = {
  organisations: "Sign-in and every org-scoped read",
  projects: "Everything",
  documents: "Knowledge base retrieval",
  conversations: "Every transcript",
  messages: "Every transcript",
  rate_limits: "Abuse protection falls back to in-memory",
  indexing_jobs: "Documentation crawls",
  tickets: "The support inbox",
  webhook_logs: "Escalation delivery, and escalations THROW without it",
  token_usage: "Cost reporting in the admin console",
  action_events: "The Actions audit trail",
  case_access_log: "Who viewed or exported a case record",
  escalation_deliveries: "Retrying escalations that never arrived",
  audit_logs: "The change history shown on Account",
  org_members: "Roles fall back to the default for everyone",
  doc_sources: "Change detection, so every crawl re-embeds everything",
  ticket_events: "Ticket history and assignment",
}

export interface SchemaReport {
  missing: { table: string; impact: string }[]
  checked: number
  /** True when we could not check at all, which is not the same as "fine". */
  inconclusive: boolean
}

/**
 * Probe each table with a zero-row read.
 *
 * `select id limit 0` is the cheapest way to ask "does this relation exist"
 * through PostgREST: a missing table answers with an error code rather than
 * data, and an existing one transfers nothing.
 */
export async function checkSchema(): Promise<SchemaReport> {
  const supabase = createServiceClient()
  const names = Object.keys(EXPECTED_TABLES)

  try {
    const results = await Promise.all(
      names.map(async (table) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabase as any).from(table).select("*").limit(0)
        // PostgREST answers 42P01 (undefined_table) or PGRST205 (not in schema
        // cache) for a table that is not there. Any OTHER error is a
        // permission or connection problem, and reporting that as "missing"
        // would send someone to write a migration for a table that exists.
        const absent =
          !!error && (error.code === "42P01" || error.code === "PGRST205" ||
            /does not exist|could not find the table/i.test(error.message ?? ""))
        return { table, absent }
      }),
    )
    return {
      missing: results
        .filter(r => r.absent)
        .map(r => ({ table: r.table, impact: EXPECTED_TABLES[r.table] ?? "Unknown" })),
      checked: names.length,
      inconclusive: false,
    }
  } catch {
    return { missing: [], checked: 0, inconclusive: true }
  }
}
