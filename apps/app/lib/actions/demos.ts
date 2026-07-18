"use server"

import { currentUser } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { DEFAULT_CONFIG } from "@/lib/types/config"
import type { ProjectConfig, ChainId } from "@/lib/types/config"
import type { Json } from "@/lib/supabase/types"
import { fetchAbiFromExplorer, fetchAbiWithProxy } from "@txid/blockchain"
import { crawlAndIngestCore, type CrawlResult } from "@/lib/ingest-core"
import { revalidatePath } from "next/cache"

// Admin-only "demo creator": pre-configured demo widgets for sales calls. Each
// demo is a real project row under a dedicated internal "Demos" org, flagged
// publicDemo (works on any site, no domain check) + active. Kept out of a
// customer's org so it never touches their dashboard or the normal per-user
// project flow. All actions are admin-gated + scoped to the Demos org.

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map(e => e.trim()).filter(Boolean)
const DEMOS_ORG_KEY = "internal-txid-demos"

async function assertAdmin(): Promise<void> {
  const user = await currentUser()
  const email = user?.emailAddresses?.find(e => e.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase()
  if (!email || (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(email))) throw new Error("Forbidden")
}

async function demosOrgId(supabase: ReturnType<typeof createServiceClient>): Promise<string> {
  const { data, error } = await supabase
    .from("organisations")
    .upsert({ clerk_org_id: DEMOS_ORG_KEY, name: "TxID Demos" }, { onConflict: "clerk_org_id" })
    .select("id")
    .single()
  if (error || !data) throw new Error("Could not resolve demos org")
  return (data as { id: string }).id
}

/** Confirm a project id belongs to the Demos org (so admin actions can't touch real customer projects). */
async function assertDemoProject(supabase: ReturnType<typeof createServiceClient>, orgId: string, projectId: string): Promise<ProjectConfig> {
  const { data } = await supabase.from("projects").select("id, org_id, config").eq("id", projectId).single()
  const row = data as { org_id: string; config: unknown } | null
  if (!row || row.org_id !== orgId) throw new Error("Not a demo project")
  return (row.config ?? {}) as ProjectConfig
}

export interface DemoSummary {
  id: string
  name: string
  key: string
  branding: ProjectConfig["branding"]
  chains: ChainId[]
  contractCount: number
  docsUrl: string | null
}

export async function listDemos(): Promise<DemoSummary[]> {
  await assertAdmin()
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  const { data } = await supabase
    .from("projects")
    .select("id, name, publishable_key, config")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
  return ((data ?? []) as unknown as { id: string; name: string; publishable_key: string; config: ProjectConfig }[]).map(p => ({
    id: p.id,
    name: p.name,
    key: p.publishable_key,
    branding: p.config?.branding ?? DEFAULT_CONFIG.branding,
    chains: p.config?.chains ?? ["0x1"],
    contractCount: (p.config?.watchedContracts ?? []).length,
    docsUrl: p.config?.docsUrl ?? null,
  }))
}

export async function createDemo(name: string): Promise<DemoSummary> {
  await assertAdmin()
  const clean = name.trim().slice(0, 80) || "New demo"
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  const config: ProjectConfig = { ...DEFAULT_CONFIG, publicDemo: true }
  const { data, error } = await supabase
    .from("projects")
    .insert({ org_id: orgId, name: clean, mode: "support", is_active: true, config: config as unknown as Json } as never)
    .select("id, name, publishable_key, config")
    .single()
  if (error || !data) throw new Error(`Create demo failed: ${error?.message}`)
  const p = data as unknown as { id: string; name: string; publishable_key: string; config: ProjectConfig }
  revalidatePath("/admin/demos")
  return { id: p.id, name: p.name, key: p.publishable_key, branding: p.config.branding, chains: p.config.chains ?? ["0x1"], contractCount: 0, docsUrl: null }
}

export async function renameDemo(id: string, name: string): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  await assertDemoProject(supabase, orgId, id)
  await supabase.from("projects").update({ name: name.trim().slice(0, 80) || "Demo" }).eq("id", id)
  revalidatePath("/admin/demos")
}

export async function deleteDemo(id: string): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  await assertDemoProject(supabase, orgId, id)
  await supabase.from("projects").delete().eq("id", id)
  revalidatePath("/admin/demos")
}

/** Merge a config patch into a demo (branding, chains, etc.). publicDemo stays on. */
export async function updateDemoConfig(id: string, patch: Partial<ProjectConfig>): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  const config = await assertDemoProject(supabase, orgId, id)
  const next: ProjectConfig = { ...config, ...patch, publicDemo: true }
  await supabase.from("projects").update({ config: next as unknown as Json } as never).eq("id", id)
  revalidatePath("/admin/demos")
}

export async function addDemoContract(id: string, address: string, chain: ChainId, contractName: string): Promise<{ ok: boolean; error?: string }> {
  await assertAdmin()
  if (!/^0x[0-9a-fA-F]{40}$/.test(address.trim())) return { ok: false, error: "Enter a valid contract address" }
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  const config = await assertDemoProject(supabase, orgId, id)
  const abi = await fetchAbiWithProxy(address.trim(), chain, fetchAbiFromExplorer).catch(() => null)
  const contract = {
    id: crypto.randomUUID(),
    name: contractName.trim() || `Contract ${address.slice(0, 6)}`,
    address: address.trim(),
    chain,
    description: "",
    ...(abi ? { abi, abiSource: "explorer" as const } : {}),
  }
  const watchedContracts = [...(config.watchedContracts ?? []), contract]
  const chains = Array.from(new Set([...(config.chains ?? []), chain])) as ChainId[]
  await supabase.from("projects").update({ config: { ...config, watchedContracts, chains, publicDemo: true } as unknown as Json } as never).eq("id", id)
  revalidatePath("/admin/demos")
  return { ok: true }
}

export async function removeDemoContract(id: string, contractId: string): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  const config = await assertDemoProject(supabase, orgId, id)
  const watchedContracts = (config.watchedContracts ?? []).filter(c => c.id !== contractId)
  await supabase.from("projects").update({ config: { ...config, watchedContracts } as unknown as Json } as never).eq("id", id)
  revalidatePath("/admin/demos")
}

/** Crawl + index the prospect's docs into this demo's knowledge base (RAG),
 *  so the demo bot answers questions from their real documentation. */
export async function addDemoDocs(id: string, url: string): Promise<CrawlResult> {
  await assertAdmin()
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  const config = await assertDemoProject(supabase, orgId, id)
  const result = await crawlAndIngestCore(supabase, id, url)
  if (result.ok) {
    await supabase.from("projects").update({ config: { ...config, docsUrl: url, publicDemo: true } as unknown as Json } as never).eq("id", id)
    revalidatePath("/admin/demos")
  }
  return result
}

/** Indexed-doc stats for a demo (pages + chunks), for the dashboard. */
export async function demoDocsInfo(id: string): Promise<{ docsUrl: string | null; chunks: number; pages: number }> {
  await assertAdmin()
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  const config = await assertDemoProject(supabase, orgId, id)
  const { data } = await supabase.from("documents").select("source_url").eq("project_id", id)
  const rows = (data ?? []) as { source_url: string | null }[]
  return { docsUrl: config.docsUrl ?? null, chunks: rows.length, pages: new Set(rows.map(r => r.source_url)).size }
}

/** Clear a demo's indexed docs. */
export async function clearDemoDocs(id: string): Promise<void> {
  await assertAdmin()
  const supabase = createServiceClient()
  const orgId = await demosOrgId(supabase)
  const config = await assertDemoProject(supabase, orgId, id)
  await supabase.from("documents").delete().eq("project_id", id)
  await supabase.from("projects").update({ config: { ...config, docsUrl: null } as unknown as Json } as never).eq("id", id)
  revalidatePath("/admin/demos")
}
