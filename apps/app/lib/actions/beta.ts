"use server"

import { requireCapability } from "@/lib/roles-server"
import { revalidatePath } from "next/cache"
import { getProject, updateConfig } from "@/lib/actions/project"
import type { BetaConfig, ProjectConfig } from "@/lib/types/config"

/**
 * Save the beta programme block.
 *
 * WRITES THE WHOLE BLOCK, not a patch: the form holds every field, so a partial
 * write would only create a way for the two to disagree.
 *
 * `endsAt` is stored as given and resolved on READ by `activeBeta`, so nothing
 * has to run for a finished beta to stop behaving like one.
 */
export async function saveBeta(beta: BetaConfig): Promise<void> {
  await requireCapability("settings")
  const { project } = await getProject()
  if (!project) throw new Error("No project")

  const clean: BetaConfig = {
    enabled: beta.enabled === true,
    autoOpen: beta.autoOpen === true,
    feedback: beta.feedback === true,
    intro: beta.intro?.trim() ? beta.intro.trim().slice(0, 600) : null,
    endsAt: beta.endsAt?.trim() ? beta.endsAt.trim() : null,
  }

  await updateConfig((project as { id: string }).id, { beta: clean } as Partial<ProjectConfig>)
  revalidatePath("/dashboard/persona")
}
