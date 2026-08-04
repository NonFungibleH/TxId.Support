"use server"

import { requireCapability } from "@/lib/roles-server"

import { getProject } from "@/lib/actions/project"
import { updateConfig } from "@/lib/actions/project"
import { testIntegration, deliverOne } from "@/lib/integrations/escalation"
import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { recordAudit } from "@/lib/audit"
import type { ProjectConfig, Integrations, IntegrationTarget } from "@/lib/types/config"
import { encryptIntegration } from "@/lib/secrets"

// Save one integration's config (merging into config.integrations), and test
// a target with a sample escalation. Secrets never leave the server - the
// dashboard sends new values in and only ever reads back {configured} booleans.

/**
 * Merge a patch into one integration's config. The client omits blank secret
 * fields, so a merge preserves the stored secret (write-only pattern) - a saved
 * token is never sent back to the browser and never overwritten with empty.
 */
export async function saveIntegration(target: IntegrationTarget, patch: Record<string, unknown>): Promise<void> {
  await requireCapability("settings")
  const { project } = await getProject()
  if (!project) throw new Error("No project")
  const config = (project as { config: unknown }).config as ProjectConfig
  const existing = (config.integrations?.[target] ?? {}) as Record<string, unknown>
  // Encrypt at the boundary, so a credential is never written in plaintext.
  // Existing values are already encrypted and are left alone by the merge.
  const merged = { ...existing, ...encryptIntegration(target, patch) }
  const next = { ...(config.integrations ?? {}), [target]: merged } as Integrations
  await updateConfig((project as { id: string }).id, { integrations: next })
  // updateConfig already logs "config.updated", but that only says
  // "integrations". Which one, and whether a credential was replaced, is the
  // part a reviewer actually asks about. `patch` keys only, never values.
  void recordAudit({
    action: "integration.saved",
    target,
    projectId: (project as { id: string }).id,
    metadata: { fields: Object.keys(patch) },
  })
}

export async function testIntegrationAction(target: IntegrationTarget): Promise<{ ok: boolean; error?: string; url?: string }> {
  await requireCapability("settings")
  const { project } = await getProject()
  if (!project) return { ok: false, error: "No project" }
  const config = (project as { config: unknown }).config as ProjectConfig
  if (!config.integrations?.[target]) return { ok: false, error: "Save the settings first, then test." }
  const res = await testIntegration(target, config.integrations, config.telegramBotToken ?? undefined)
  return { ok: res.ok, ...(res.error ? { error: res.error } : {}), ...(res.url ? { url: res.url } : {}) }
}

/**
 * Escalations that never reached their destination.
 *
 * The user was told a human would follow up. Until one of these rows is
 * delivered or abandoned, that promise is outstanding, so it belongs on screen
 * rather than in a table nobody reads.
 */
export interface FailedDelivery {
  id: string
  target: string
  ticketRef: string
  status: string
  attempts: number
  lastError: string | null
  nextAttemptAt: string
  createdAt: string
}

export async function listFailedDeliveries(): Promise<FailedDelivery[]> {
  const { project } = await getProject()
  if (!project) return []
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("escalation_deliveries")
    .select("id, target, ticket_ref, status, attempts, last_error, next_attempt_at, created_at")
    .eq("project_id", (project as { id: string }).id)
    .in("status", ["pending", "abandoned"])
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(r => ({
    id: r.id,
    target: r.target,
    ticketRef: r.ticket_ref,
    status: r.status,
    attempts: r.attempts,
    lastError: r.last_error ?? null,
    nextAttemptAt: r.next_attempt_at,
    createdAt: r.created_at,
  }))
}

/**
 * Send one parked escalation again, now. The worker will get to it eventually,
 * but "eventually" is not what you want when you have just fixed the webhook
 * and need to know it works.
 */
export async function retryDelivery(id: string): Promise<{ ok: boolean; error?: string }> {
  await requireCapability("tickets")
  const { project } = await getProject()
  if (!project) return { ok: false, error: "No project" }
  const projectId = (project as { id: string }).id
  const config = (project as { config: unknown }).config as ProjectConfig
  if (!config.integrations) return { ok: false, error: "No integrations configured" }

  const supabase = createServiceClient()
  // Scoped to this project, so an id from elsewhere finds nothing.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: row } = await (supabase as any)
    .from("escalation_deliveries")
    .select("id, target, ticket_ref, payload, attempts")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle()
  if (!row) return { ok: false, error: "Not found" }

  const res = await deliverOne(
    row.target as IntegrationTarget,
    row.payload,
    config.integrations,
    config.telegramBotToken ?? undefined,
  )
  const attempts = row.attempts + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("escalation_deliveries")
    .update(
      res.ok
        ? { status: "delivered", attempts, last_error: null, updated_at: new Date().toISOString() }
        : {
            status: "pending",
            attempts,
            last_error: (res.error ?? "failed").slice(0, 500),
            next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
            updated_at: new Date().toISOString(),
          },
    )
    .eq("id", id)

  // Someone re-sent a user's escalation by hand. Worth a dated record: it is
  // a message leaving the system on a team member's say-so.
  void recordAudit({
    action: "escalation.redelivered",
    target: row.target as string,
    projectId,
    metadata: { ticketRef: row.ticket_ref, delivered: res.ok },
  })

  revalidatePath("/dashboard/tickets")
  return res.ok ? { ok: true } : { ok: false, ...(res.error ? { error: res.error } : {}) }
}
