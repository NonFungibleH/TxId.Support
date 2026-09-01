import { createServiceClient } from "@/lib/supabase/server"
import { log } from "@/lib/logger"
import type { Resolution } from "./types"

/**
 * Persist one resolution.
 *
 * NEVER FAILS THE THING IT ACCOMPANIES. Recording is a side effect: refusing to
 * answer a user because a stats table is unreachable is strictly worse than a
 * gap in the stats. Same rule as recordAudit(), and it is the property that
 * makes this safe to call from the live chat path.
 *
 * Callers must NOT await this on a latency-sensitive path. Fire it after the
 * response has gone out.
 */
export type ResolutionSource = "api" | "agent" | "console"

export async function recordResolution(
  resolution: Resolution,
  ctx: {
    projectId: string
    source: ResolutionSource
    chain?: string | null
    txHash?: string | null
    protocolAddress?: string | null
    entryFunction?: string | null
    rawStatus?: string | null
    /** The customer as the protocol knows them, when the wallet resolves. */
    customerRef?: string | null
    wallet?: string | null
  },
): Promise<void> {
  try {
    const supabase = createServiceClient()
    // The generated Supabase types are produced from the local schema, which
    // does not carry this table until the migration is applied. Same cast and
    // same reason as audit_logs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any).from("resolutions").insert({
      project_id: ctx.projectId,
      // The resolution's own chain wins; ctx.chain is the fallback for a
      // lookup that never resolved far enough to know.
      chain: resolution.chain ?? ctx.chain ?? "unknown",
      tx_hash: resolution.hash ?? ctx.txHash ?? null,
      protocol_address: ctx.protocolAddress ?? null,
      entry_function: ctx.entryFunction ?? null,
      txid_code: resolution.txid_code,
      cause: resolution.cause,
      recommended_action: resolution.recommended_action,
      category: resolution.category,
      status: resolution.status,
      custody: resolution.custody,
      next_action_owner: resolution.next_action_owner,
      retryable: resolution.retryable ?? null,
      basis: resolution.basis,
      source: ctx.source,
      raw_status: resolution.raw ?? ctx.rawStatus ?? null,
      // Stored as a column, not left in jsonb: the case list renders it for
      // every row and cannot afford to unpack a document per row.
      summary: resolution.summary ?? null,
      customer_ref: ctx.customerRef ?? null,
      wallet: ctx.wallet ?? null,
      evidence: resolution.evidence ?? [],
    })
    if (error) {
      // A missing table is the expected state before the migration is applied,
      // and it must not read as an incident. Production schema drift is
      // documented in CLAUDE.md as a recurring reality here.
      log.warn("resolution not recorded", {
        event: "resolution.record_failed",
        reason: error.message,
        source: ctx.source,
      })
    }
  } catch (err) {
    log.warn("resolution not recorded", {
      event: "resolution.record_threw",
      reason: err instanceof Error ? err.message : "unknown",
      source: ctx.source,
    })
  }
}
