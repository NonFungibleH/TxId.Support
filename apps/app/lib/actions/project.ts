"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import { DEFAULT_CONFIG } from "@/lib/types/config"
import { revalidatePath } from "next/cache"
import type { Database, Json } from "@/lib/supabase/types"

type OrgRow = Database["public"]["Tables"]["organisations"]["Row"]

export async function getProject() {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const upsertOrgResult = await supabase
    .from("organisations")
    .upsert(
      { clerk_org_id: orgKey, name: "My Protocol" },
      { onConflict: "clerk_org_id" }
    )
    .select()
    .single()

  const org = upsertOrgResult.data as unknown as OrgRow | null
  const orgError = upsertOrgResult.error
  if (orgError || !org) throw new Error(`Org upsert failed: ${orgError?.message}`)

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at")
    .limit(1)
    .maybeSingle()

  return { org, project: project ?? null }
}

export async function createProject(name: string) {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const upsertOrgResult2 = await supabase
    .from("organisations")
    .upsert(
      { clerk_org_id: orgKey, name: "My Protocol" },
      { onConflict: "clerk_org_id" }
    )
    .select()
    .single()

  const org = upsertOrgResult2.data as unknown as OrgRow | null
  if (!org) throw new Error("Could not resolve organisation")

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: org.id,
      name,
      config: DEFAULT_CONFIG as unknown as Json,
    })
    .select()
    .single()

  if (error || !project) throw new Error(`Create project failed: ${error?.message}`)

  revalidatePath("/dashboard")
  return project
}

export async function createProjectWithMode(name: string, mode: "support" | "token") {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const upsertOrgResult = await supabase
    .from("organisations")
    .upsert(
      { clerk_org_id: orgKey, name: "My Protocol" },
      { onConflict: "clerk_org_id" }
    )
    .select()
    .single()

  const org = upsertOrgResult.data as unknown as OrgRow | null
  if (!org) throw new Error("Could not resolve organisation")

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      org_id: org.id,
      name,
      mode,
      config: DEFAULT_CONFIG as unknown as Json,
    })
    .select()
    .single()

  if (error || !project) throw new Error(`Create project failed: ${error?.message}`)

  revalidatePath("/dashboard")
  return project
}

export async function updateConfig(
  projectId: string,
  partial: Partial<ProjectConfig>
) {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const { data: current, error: fetchError } = await supabase
    .from("projects")
    .select("config, org_id")
    .eq("id", projectId)
    .single()

  if (fetchError || !current) throw new Error("Project not found")

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org || current.org_id !== org.id) throw new Error("Forbidden")

  const merged = {
    ...(current.config as unknown as ProjectConfig),
    ...partial,
  }

  const { error: updateError } = await supabase
    .from("projects")
    .update({ config: merged as unknown as Json })
    .eq("id", projectId)

  if (updateError) throw new Error(`Update failed: ${updateError.message}`)

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/branding")
  revalidatePath("/dashboard/token")
  revalidatePath("/dashboard/contracts")
  revalidatePath("/dashboard/docs")
  revalidatePath("/dashboard/chains")
  revalidatePath("/dashboard/content")
  revalidatePath("/dashboard/community")
  revalidatePath("/dashboard/ask")
}

export async function toggleActive(projectId: string, isActive: boolean) {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org) throw new Error("Org not found")

  const { error } = await supabase
    .from("projects")
    .update({ is_active: isActive })
    .eq("id", projectId)
    .eq("org_id", org.id)

  if (error) throw new Error(error.message)

  revalidatePath("/dashboard")
}
