"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ProjectConfig, WatchedContract } from "@/lib/types/config"
import type { Database, Json } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const AddContractSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid 0x address"),
  chain: z.string().min(1, "Chain is required"),
  description: z.string().min(1, "Description is required").max(500),
})

async function resolveProjectWithOwnership(
  projectId: string
): Promise<Pick<ProjectRow, "id" | "config" | "org_id">> {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const orgResult = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .single()

  const orgData = orgResult.data as unknown as { id: string } | null
  if (!orgData) throw new Error("Org not found")

  const projectResult = await supabase
    .from("projects")
    .select("id, config, org_id")
    .eq("id", projectId)
    .eq("org_id", orgData.id)
    .single()

  const project = projectResult.data as unknown as Pick<ProjectRow, "id" | "config" | "org_id"> | null
  if (projectResult.error || !project) throw new Error("Project not found or forbidden")

  return project
}

export async function addContract(
  projectId: string,
  input: { name: string; address: string; chain: string; description: string }
) {
  const parsed = AddContractSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig
  const existing = config.watchedContracts ?? []

  if (existing.length >= 20) throw new Error("Maximum of 20 watched contracts per project")

  const newContract: WatchedContract = {
    id: nanoid(),
    name: parsed.data.name,
    address: parsed.data.address.toLowerCase(),
    chain: parsed.data.chain as WatchedContract["chain"],
    description: parsed.data.description,
  }

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: [...existing, newContract],
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
  return newContract
}

export async function removeContract(projectId: string, contractId: string) {
  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: (config.watchedContracts ?? []).filter((c) => c.id !== contractId),
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
}
