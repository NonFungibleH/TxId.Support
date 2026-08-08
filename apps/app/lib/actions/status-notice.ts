"use server"

import { waitUntil } from "@vercel/functions"
import { revalidatePath } from "next/cache"
import { requireCapability } from "@/lib/roles-server"
import { getProject, updateConfig } from "@/lib/actions/project"
import { recordAudit } from "@/lib/audit"
import type { ProjectConfig, IncidentConfig, IncidentLevel } from "@/lib/types/config"

/**
 * Raise or clear the protocol's own status notice.
 *
 * PERMISSION IS `tickets`, NOT `settings`, deliberately. The person who
 * notices at 3am is whoever is on support, and a control that only an Admin
 * can reach is a control that goes unused during the hour it exists for. It is
 * also fully audited and easy to undo, which is the trade that makes the
 * looser permission the safer choice overall.
 */
export async function setStatusNotice(input: {
  level: IncidentLevel
  message: string
  topics?: string[]
  expiresInHours?: number
}): Promise<void> {
  const actor = await requireCapability("tickets")
  const message = input.message.trim()
  if (!message) throw new Error("Write the message your users will see.")

  const { project } = await getProject()
  if (!project) throw new Error("No project")
  const projectId = (project as { id: string }).id

  // Default four hours: long enough to work an issue, short enough that a
  // forgotten notice takes itself down rather than going stale in public.
  const hours = input.expiresInHours ?? 4
  const incident: IncidentConfig = {
    level: input.level,
    message,
    ...(input.topics?.length ? { topics: input.topics.slice(0, 8) } : {}),
    raisedAt: new Date().toISOString(),
    raisedBy: actor.userId,
    expiresAt: hours > 0 ? new Date(Date.now() + hours * 3600_000).toISOString() : null,
  }

  await updateConfig(projectId, { incident } as Partial<ProjectConfig>)

  // Post-mortems and regulators ask "when did you tell your users?". This
  // answers it exactly, including the wording that was actually shown.
  waitUntil(recordAudit({
    action: "status_notice.raised",
    target: input.level,
    projectId,
    metadata: { message, topics: input.topics ?? [], expiresAt: incident.expiresAt },
  }))

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/tickets")
}

export async function clearStatusNotice(): Promise<void> {
  await requireCapability("tickets")
  const { project } = await getProject()
  if (!project) throw new Error("No project")
  const projectId = (project as { id: string }).id

  await updateConfig(projectId, { incident: null } as Partial<ProjectConfig>)
  waitUntil(recordAudit({ action: "status_notice.cleared", projectId }))

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/tickets")
}
