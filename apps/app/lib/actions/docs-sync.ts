"use server"

import { revalidatePath } from "next/cache"
import { requireCapability } from "@/lib/roles-server"
import { getProject, updateConfig } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"

export async function setDocsSync(enabled: boolean, frequency: "daily" | "weekly"): Promise<void> {
  await requireCapability("settings")
  const { project } = await getProject()
  if (!project) throw new Error("No project")
  await updateConfig((project as { id: string }).id, {
    docsSync: { enabled, frequency },
  } as Partial<ProjectConfig>)
  revalidatePath("/dashboard/docs")
}

export interface DocsFreshness {
  pages: number
  lastChecked: string | null
  lastChanged: string | null
}

/**
 * How fresh the knowledge base is.
 *
 * OLDEST checked, not newest: one page checked a minute ago says nothing about
 * the other ninety-nine. The weakest link is the honest number.
 */
export async function docsFreshness(projectId: string): Promise<DocsFreshness> {
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("doc_sources")
    .select("last_checked_at, last_changed_at")
    .eq("project_id", projectId)
  if (error || !data) return { pages: 0, lastChecked: null, lastChanged: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = data as any[]
  const checked = rows.map(r => r.last_checked_at).filter(Boolean).sort()
  const changed = rows.map(r => r.last_changed_at).filter(Boolean).sort()
  return {
    pages: rows.length,
    lastChecked: checked[0] ?? null,
    lastChanged: changed[changed.length - 1] ?? null,
  }
}
