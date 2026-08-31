import { createServiceClient } from "@/lib/supabase/server"

/**
 * Record that someone read a case record, exported it, or copied the reply.
 *
 * "Who has seen this client's data?" is one of the first questions an
 * institutional reviewer asks, and an answer that depends on server logs
 * nobody retains is not an answer. The log is append-only at the database
 * level, so this cannot be quietly rewritten later.
 *
 * Never allowed to fail a read: an unrecorded view is bad, a dashboard that
 * 500s because logging broke is worse. Failures are swallowed here and remain
 * visible in the application logs.
 */
export async function recordCaseAccess(params: {
  projectId: string
  actor: string
  action: "view" | "export" | "reply"
  conversationId?: string
  detail?: Record<string, unknown>
}): Promise<void> {
  try {
    const supabase = createServiceClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("case_access_log").insert({
      project_id: params.projectId,
      conversation_id: params.conversationId ?? null,
      actor: params.actor,
      action: params.action,
      detail: params.detail ?? null,
    })
  } catch {
    // Table may not exist yet on a deployment that has not run the migration.
  }
}
