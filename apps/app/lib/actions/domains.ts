"use server"

import { requireCapability } from "@/lib/roles-server"
import { revalidatePath } from "next/cache"
import { getProject, updateConfig } from "@/lib/actions/project"
import type { ProjectConfig } from "@/lib/types/config"

/**
 * The domains a project's publishable key may be used from.
 *
 * WHY THIS ACTION DID NOT EXIST UNTIL NOW: `allowedDomains` was in the config
 * type and enforced by the chat route, but nothing could ever write it. The
 * list was therefore empty for every project in existence, and empty means
 * open, so the guard had never once refused a request. A publishable key sits
 * in plain HTML on the customer's page; without this, anyone could lift one
 * and spend the customer's quota from anywhere.
 */

/** Accept what people actually paste, store what the guard compares against. */
function normalise(input: string): string | null {
  const raw = input.trim().toLowerCase()
  if (!raw) return null
  const withScheme = /^https?:\/\//.test(raw) ? raw : `https://${raw}`
  try {
    const host = new URL(withScheme).hostname
    // A bare hostname only: no scheme, no path, no port, which is exactly what
    // the request's Origin header reduces to.
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null
  } catch {
    return null
  }
}

export async function setAllowedDomains(domains: string[]): Promise<{ saved: string[] }> {
  await requireCapability("settings")
  const { project } = await getProject()
  if (!project) throw new Error("No project")

  // Deduped, capped, and invalid entries dropped rather than stored as noise
  // that would silently never match anything.
  const clean = Array.from(
    new Set(domains.map(normalise).filter((d): d is string => !!d)),
  ).slice(0, 20)

  await updateConfig((project as { id: string }).id, {
    allowedDomains: clean,
  } as Partial<ProjectConfig>)

  revalidatePath("/dashboard/embed")
  return { saved: clean }
}
