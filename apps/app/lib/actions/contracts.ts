"use server"

import { requireCapability } from "@/lib/roles-server"

import { resolveOrg } from "@/lib/clerk-org"
import { createServiceClient } from "@/lib/supabase/server"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"
import { z } from "zod"
import type { ProjectConfig, WatchedContract, ErrorGlossaryEntry, Plan } from "@/lib/types/config"
import { PLAN_CHAIN_LIMITS } from "@/lib/types/config"
import type { Database, Json } from "@/lib/supabase/types"
import { fetchAbiFromExplorer, fetchAbiWithProxy } from "@txid/blockchain"
import { fetchIdlFromRegistry } from "@txid/solana"
import { getAptosModuleAbi } from "@txid/aptos"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const APTOS_ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/
const MOVE_MODULE_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

const AddContractSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  address: z.string(),
  chain: z.string().min(1, "Chain is required"),
  description: z.string().min(1, "Description is required").max(500),
  moduleName: z.string().trim().regex(MOVE_MODULE_RE, "Module name must be a valid Move identifier").optional(),
}).superRefine((data, ctx) => {
  const valid = data.chain === "aptos"
    ? APTOS_ADDRESS_RE.test(data.address)
    : EVM_ADDRESS_RE.test(data.address)
  if (!valid) {
    ctx.addIssue({
      code: "custom",
      path: ["address"],
      message: data.chain === "aptos" ? "Must be a valid Aptos address" : "Must be a valid 0x address",
    })
  }
})

// Aptos module ABIs are read live on-chain by the AI tools; the stored copy is
// informational (Solana/IDL precedent). Returns JSON of one module or the list.
async function fetchAptosAbiJson(address: string, moduleName?: string): Promise<string | null> {
  const result = moduleName
    ? await getAptosModuleAbi(address, moduleName).catch(() => null)
    : await getAptosModuleAbi(address).catch(() => null)
  if (!result || (Array.isArray(result) && result.length === 0)) return null
  return JSON.stringify(result)
}

async function resolveProjectWithOwnership(
  projectId: string
): Promise<Pick<ProjectRow, "id" | "config" | "org_id">> {
  const { orgId, userId } = await resolveOrg()
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
  input: { name: string; address: string; chain: string; description: string; moduleName?: string }
) {
  await requireCapability("settings")
  const parsed = AddContractSchema.safeParse(input)
  if (!parsed.success) throw new Error(parsed.error.issues[0].message)

  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig
  const existing = config.watchedContracts ?? []

  if (existing.length >= 20) throw new Error("Maximum of 20 watched contracts per project")

  // Enforce chain limit - derived from existing contracts + token (chains page removed)
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

  const isAptos = parsed.data.chain === "aptos"
  const moduleName = isAptos ? parsed.data.moduleName : undefined

  // Try to fetch ABI automatically. EVM: block explorer, proxy-aware (if the
  // address is a proxy, the implementation ABI is merged in so the bot can read
  // the real events/getters, not just upgrade plumbing). Aptos: fullnode module ABI.
  const abi = isAptos
    ? await fetchAptosAbiJson(parsed.data.address, moduleName)
    : await fetchAbiWithProxy(
        parsed.data.address.toLowerCase(),
        parsed.data.chain,
        fetchAbiFromExplorer,
      ).catch(() => null)

  const newContract: WatchedContract = {
    id: nanoid(),
    name: parsed.data.name,
    address: parsed.data.address.toLowerCase(),
    chain: parsed.data.chain as WatchedContract["chain"],
    description: parsed.data.description,
    ...(moduleName ? { moduleName } : {}),
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
  await requireCapability("settings")
  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig
  const contract = (config.watchedContracts ?? []).find((c) => c.id === contractId)
  if (!contract) throw new Error("Contract not found")

  const abi = contract.chain === "solana"
    ? await fetchIdlFromRegistry(contract.address)
    : contract.chain === "aptos"
    ? await fetchAptosAbiJson(contract.address, contract.moduleName)
    : await fetchAbiWithProxy(contract.address, contract.chain, fetchAbiFromExplorer)

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
  await requireCapability("settings")
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

export async function updateContractDetails(
  projectId: string,
  contractId: string,
  input: { name: string; description: string },
) {
  await requireCapability("settings")
  const name = input.name.trim()
  const description = input.description.trim()
  if (!name) throw new Error("Name is required")
  if (name.length > 80) throw new Error("Name is too long (max 80)")
  if (!description) throw new Error("Description is required")
  if (description.length > 500) throw new Error("Description is too long (max 500)")

  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig

  const updated: ProjectConfig = {
    ...config,
    watchedContracts: (config.watchedContracts ?? []).map((c) =>
      c.id !== contractId ? c : { ...c, name, description },
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

export async function addAudit(projectId: string, input: { auditor: string; url: string; date?: string }) {
  await requireCapability("settings")
  const auditor = input.auditor.trim()
  const url = input.url.trim()
  if (!auditor) throw new Error("Auditor name is required")
  if (!/^https?:\/\//.test(url)) throw new Error("Report URL must start with http:// or https://")

  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig
  const updated: ProjectConfig = {
    ...config,
    audits: [
      ...(config.audits ?? []),
      { id: nanoid(8), auditor, url, ...(input.date?.trim() ? { date: input.date.trim() } : {}) },
    ],
  }

  const supabase = createServiceClient()
  const { error } = await supabase.from("projects").update({ config: updated as unknown as Json }).eq("id", projectId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
}

export async function removeAudit(projectId: string, auditId: string) {
  await requireCapability("settings")
  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig
  const updated: ProjectConfig = { ...config, audits: (config.audits ?? []).filter(a => a.id !== auditId) }

  const supabase = createServiceClient()
  const { error } = await supabase.from("projects").update({ config: updated as unknown as Json }).eq("id", projectId)
  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/contracts")
}

export async function clearContractAbi(projectId: string, contractId: string) {
  await requireCapability("settings")
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
  await requireCapability("settings")
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
  await requireCapability("settings")
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
  await requireCapability("settings")
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
 * No auth required - this is read-only public blockchain data.
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

export interface AptosModulePeek {
  name: string
  entryCount: number
  viewCount: number
}

/**
 * Lists the Move modules published at an Aptos address, with entry/view
 * function counts. No auth required - this is read-only public chain data.
 */
export async function peekAptosModules(
  address: string,
): Promise<{ modules: AptosModulePeek[] } | { error: string }> {
  const clean = address.trim()
  if (!APTOS_ADDRESS_RE.test(clean)) return { error: "Enter a valid Aptos address" }
  // One retry. A single transient fullnode hiccup (a 429 while unauthenticated,
  // or a cold-start timeout) otherwise shows the user "could not fetch modules"
  // for an address that is perfectly fine: observed on PancakeSwap's package,
  // which then fetched successfully on save moments later. Measured at 8/8
  // successes in ~400ms each, so a failure is worth one more attempt before
  // telling someone their address might be wrong.
  let modules = await getAptosModuleAbi(clean).catch(() => null)
  if (!modules) {
    await new Promise(r => setTimeout(r, 600))
    modules = await getAptosModuleAbi(clean).catch(() => null)
  }
  // The fullnode client returns null for BOTH not-found and network failure,
  // so the error must stay honestly ambiguous - never a confident "no modules".
  if (!modules) {
    return { error: "Could not reach the Aptos fullnode twice in a row. The address may have no modules published, or the network is momentarily unavailable. You can still add it and describe it manually." }
  }
  return {
    modules: modules.map(m => ({
      name: m.moduleName,
      entryCount: m.functions.filter(f => f.isEntry).length,
      viewCount: m.functions.filter(f => f.isView).length,
    })),
  }
}
