"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ProjectConfig, WatchedContract, ErrorGlossaryEntry, Plan } from "@/lib/types/config"
import { PLAN_CHAIN_LIMITS } from "@/lib/types/config"
import type { Database, Json } from "@/lib/supabase/types"
import { fetchAbiFromExplorer } from "@txid/blockchain"

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

  // Enforce chain limit — derived from existing contracts + token (chains page removed)
  const plan = (config.plan ?? "free") as Plan
  const chainLimit = PLAN_CHAIN_LIMITS[plan]
  if (chainLimit !== Infinity) {
    const existingChains = new Set<string>([
      ...existing.map(c => c.chain as string),
      ...(config.token?.chain ? [config.token.chain as string] : []),
    ])
    if (!existingChains.has(parsed.data.chain) && existingChains.size >= chainLimit) {
      throw new Error(
        `Your plan supports ${chainLimit} chain${chainLimit === 1 ? "" : "s"}. Upgrade to add contracts on additional chains.`
      )
    }
  }

  // Try to fetch ABI from the block explorer automatically
  const abi = await fetchAbiFromExplorer(
    parsed.data.address.toLowerCase(),
    parsed.data.chain,
  ).catch(() => null)

  const newContract: WatchedContract = {
    id: nanoid(),
    name: parsed.data.name,
    address: parsed.data.address.toLowerCase(),
    chain: parsed.data.chain as WatchedContract["chain"],
    description: parsed.data.description,
    ...(abi ? { abi, abiSource: "explorer" as const } : {}),
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

export async function refreshContractAbi(projectId: string, contractId: string) {
  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig
  const contract = (config.watchedContracts ?? []).find((c) => c.id === contractId)
  if (!contract) throw new Error("Contract not found")

  const abi = await fetchAbiFromExplorer(contract.address, contract.chain)

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: (config.watchedContracts ?? []).map((c) =>
      c.id !== contractId
        ? c
        : abi
        ? { ...c, abi, abiSource: "explorer" as const }
        : { ...c, abi: undefined, abiSource: undefined },
    ),
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
  return { found: !!abi }
}

export async function saveContractAbi(projectId: string, contractId: string, abi: string) {
  // Validate it's parseable JSON
  try {
    JSON.parse(abi)
  } catch {
    throw new Error("Invalid ABI: must be a JSON array")
  }

  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: (config.watchedContracts ?? []).map((c) =>
      c.id !== contractId ? c : { ...c, abi, abiSource: "uploaded" as const },
    ),
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
}

export async function clearContractAbi(projectId: string, contractId: string) {
  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: (config.watchedContracts ?? []).map((c) =>
      c.id !== contractId ? c : { ...c, abi: undefined, abiSource: undefined },
    ),
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
}

const GlossaryEntrySchema = z.object({
  error: z.string().min(1).max(200),
  explanation: z.string().min(1).max(500),
  kind: z.enum(["error", "event"]).optional(),
})

export async function upsertGlossaryEntry(
  projectId: string,
  contractId: string,
  entry: ErrorGlossaryEntry,
) {
  const parsed = GlossaryEntrySchema.safeParse(entry)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: (config.watchedContracts ?? []).map((c) => {
      if (c.id !== contractId) return c
      const existing = c.errorGlossary ?? []
      const idx = existing.findIndex((e) => e.error === parsed.data.error)
      const newGlossary = idx >= 0
        ? existing.map((e, i) => (i === idx ? parsed.data : e))
        : [...existing, parsed.data]
      return { ...c, errorGlossary: newGlossary }
    }),
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
}

export async function removeGlossaryEntry(
  projectId: string,
  contractId: string,
  errorName: string,
) {
  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: (config.watchedContracts ?? []).map((c) => {
      if (c.id !== contractId) return c
      return { ...c, errorGlossary: (c.errorGlossary ?? []).filter((e) => e.error !== errorName) }
    }),
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
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

/**
 * Reads the public function names from a verified contract's ABI.
 * No auth required — this is read-only public blockchain data.
 * Returns null if the contract isn't verified or the explorer is unreachable.
 */
export async function peekContractFunctions(
  address: string,
  chainId: string,
): Promise<string[] | null> {
  const abiJson = await fetchAbiFromExplorer(address, chainId).catch(() => null)
  if (!abiJson) return null
  type AbiEntry = { type: string; name?: string }
  const abi = JSON.parse(abiJson) as AbiEntry[]
  const names = abi.filter(e => e.type === "function" && e.name).map(e => e.name!)
  return names.length > 0 ? names : null
}
