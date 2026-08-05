import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import {
  deliverOne,
  BACKOFF_MS,
  MAX_ATTEMPTS,
  type EscalationTicket,
} from "@/lib/integrations/escalation"
import type { IntegrationTarget } from "@/lib/types/config"

/**
 * Redeliver escalations that failed to reach their destination.
 *
 * WHY THIS EXISTS: when an escalation fails, the user has already been told a
 * human will follow up. Nobody hears. `dispatchEscalation` parks the payload in
 * `escalation_deliveries` so the promise can still be kept, but a parked row
 * nobody drains is just a nicer-looking way to lose the ticket. This is the
 * drain.
 *
 * Deliberately small: one batch, ordered by what has been waiting longest, so a
 * backlog against one broken integration cannot starve everyone else or run
 * past the function timeout.
 */

export const dynamic = "force-dynamic"
export const maxDuration = 60

const BATCH = 25

/** Vercel Cron signs its own calls; a shared secret covers manual invocation. */
/**
 * Says WHICH side is wrong, without ever revealing the value.
 *
 * A bare 401 turned this into a guessing game between "the server has no
 * secret" and "the caller sent the wrong one", which are opposite fixes: one
 * is a Vercel variable and a redeploy, the other is a GitHub secret. Naming
 * the side leaks nothing an attacker can use, because a server with no secret
 * configured is already refusing everything.
 */
function authorised(req: NextRequest): { ok: true } | { ok: false; why: string } {
  // TRIMMED ON BOTH SIDES, deliberately. Pasting a generated value into a
  // secrets field picks up a trailing newline often enough that it is the
  // most likely cause of a mismatch, and a token is not meaningfully more
  // secure for having whitespace around it.
  const secret = process.env.CRON_SECRET?.trim()
  const auth = req.headers.get("authorization")?.trim()

  // Vercel Cron signs its own scheduled calls. Not used now that the schedules
  // live in GitHub Actions, but harmless to keep.
  if (req.headers.get("x-vercel-cron") !== null) return { ok: true }

  if (!secret) {
    return {
      ok: false,
      why: "CRON_SECRET is not set on the server. Add it to the APP Vercel project, then REDEPLOY: an environment variable only reaches a new deployment.",
    }
  }
  if (!auth) return { ok: false, why: "No Authorization header was sent." }
  if (auth === `Bearer ${secret}`) return { ok: true }
  return {
    ok: false,
    why: "The token sent does not match CRON_SECRET on the server. The two values differ, commonly by a trailing newline or space when one of them was pasted.",
  }
}

export async function GET(req: NextRequest) {
  const auth = authorised(req)
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorised", detail: auth.why }, { status: 401 })
  }

  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: due, error } = await (supabase as any)
    .from("escalation_deliveries")
    .select("id, project_id, target, ticket_ref, payload, attempts")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH)

  if (error) {
    // Pre-migration, or the table is gone. Say so rather than reporting success.
    return NextResponse.json({ error: error.message ?? "query failed" }, { status: 500 })
  }

  const rows = (due ?? []) as Array<{
    id: string
    project_id: string
    target: string
    ticket_ref: string
    payload: EscalationTicket
    attempts: number
  }>
  if (rows.length === 0) {
    return NextResponse.json({ due: 0, delivered: 0, retrying: 0, abandoned: 0 })
  }

  // One config read per project, not per row: a broken Slack webhook usually
  // fails for every escalation in the batch at once.
  const projectIds = Array.from(new Set(rows.map(r => r.project_id)))
  const { data: projects } = await supabase
    .from("projects")
    .select("id, config")
    .in("id", projectIds)

  const configById = new Map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((projects ?? []) as any[]).map(p => [p.id as string, p.config ?? {}]),
  )

  let delivered = 0
  let retrying = 0
  let abandoned = 0

  await Promise.allSettled(
    rows.map(async row => {
      const config = configById.get(row.project_id)
      const integrations = config?.integrations
      if (!integrations) {
        // The integration was removed while this was parked. There is nowhere
        // left to deliver it, so stop pretending it is still in flight.
        abandoned++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("escalation_deliveries")
          .update({
            status: "abandoned",
            last_error: "integration removed before redelivery",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
        return
      }

      const result = await deliverOne(
        row.target as IntegrationTarget,
        row.payload,
        integrations,
        config?.telegramBotToken,
      )

      const attempts = row.attempts + 1

      if (result.ok) {
        delivered++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("escalation_deliveries")
          .update({ status: "delivered", attempts, last_error: null, updated_at: new Date().toISOString() })
          .eq("id", row.id)

        // The tracker issue only exists now, so the ticket needs the link.
        if (result.url) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data: ticket } = await (supabase as any)
            .from("tickets")
            .select("id, external_refs")
            .eq("ref", row.ticket_ref)
            .maybeSingle()
          if (ticket) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (supabase as any)
              .from("tickets")
              .update({ external_refs: { ...(ticket.external_refs ?? {}), [row.target]: result.url } })
              .eq("id", ticket.id)
          }
        }
        return
      }

      // Out of attempts. Leave it visible as abandoned rather than deleting it:
      // somebody needs to know a user was promised a reply nobody received.
      if (attempts >= MAX_ATTEMPTS) {
        abandoned++
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("escalation_deliveries")
          .update({
            status: "abandoned",
            attempts,
            last_error: (result.error ?? "failed").slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
        return
      }

      retrying++
      const wait = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("escalation_deliveries")
        .update({
          attempts,
          last_error: (result.error ?? "failed").slice(0, 500),
          next_attempt_at: new Date(Date.now() + wait).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
    }),
  )

  return NextResponse.json({ due: rows.length, delivered, retrying, abandoned })
}
