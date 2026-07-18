"use server"

import { getProject } from "@/lib/actions/project"
import { updateConfig } from "@/lib/actions/project"
import { testIntegration } from "@/lib/integrations/escalation"
import type { ProjectConfig, Integrations, IntegrationTarget } from "@/lib/types/config"

// Save one integration's config (merging into config.integrations), and test
// a target with a sample escalation. Secrets never leave the server — the
// dashboard sends new values in and only ever reads back {configured} booleans.

/**
 * Merge a patch into one integration's config. The client omits blank secret
 * fields, so a merge preserves the stored secret (write-only pattern) — a saved
 * token is never sent back to the browser and never overwritten with empty.
 */
export async function saveIntegration(target: IntegrationTarget, patch: Record<string, unknown>): Promise<void> {
  const { project } = await getProject()
  if (!project) throw new Error("No project")
  const config = (project as { config: unknown }).config as ProjectConfig
  const existing = (config.integrations?.[target] ?? {}) as Record<string, unknown>
  const merged = { ...existing, ...patch }
  const next = { ...(config.integrations ?? {}), [target]: merged } as Integrations
  await updateConfig((project as { id: string }).id, { integrations: next })
}

export async function testIntegrationAction(target: IntegrationTarget): Promise<{ ok: boolean; error?: string; url?: string }> {
  const { project } = await getProject()
  if (!project) return { ok: false, error: "No project" }
  const config = (project as { config: unknown }).config as ProjectConfig
  if (!config.integrations?.[target]) return { ok: false, error: "Save the settings first, then test." }
  const res = await testIntegration(target, config.integrations, config.telegramBotToken ?? undefined)
  return { ok: res.ok, ...(res.error ? { error: res.error } : {}), ...(res.url ? { url: res.url } : {}) }
}
