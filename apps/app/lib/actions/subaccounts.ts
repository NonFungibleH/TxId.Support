"use server"

import { revalidatePath } from "next/cache"
import { getProject, updateConfig } from "@/lib/actions/project"
import type { ProjectConfig } from "@/lib/types/config"

/**
 * Turn per-user protocol accounts on or off for this project.
 *
 * This only decides whether TxID looks. Whether there is anything to find comes
 * from the protocol adapter matching one of the watched contracts, so enabling
 * it on a protocol without subaccounts changes nothing rather than inventing a
 * second address the user does not have.
 */
export async function setSubaccountsEnabled(enabled: boolean): Promise<void> {
  const { project } = await getProject()
  if (!project) throw new Error("No project")
  await updateConfig((project as { id: string }).id, {
    subaccounts: { enabled },
  } as Partial<ProjectConfig>)
  revalidatePath("/dashboard/contracts")
}
