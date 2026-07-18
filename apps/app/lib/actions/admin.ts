"use server"

import { createServiceClient } from "@/lib/supabase/server"
import { assertAdmin } from "@/lib/admin-auth"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import type { Json } from "@/lib/supabase/types"
import { revalidatePath } from "next/cache"

const VALID_PLANS: Plan[] = ["free", "starter", "pro", "enterprise", "custom", "demo"]

/**
 * Set a project's plan from the admin console. Used to hand-provision early
 * users (e.g. the "demo" full-access plan) while paid pricing is negotiated
 * manually. Admin-guarded; writes projects.config.plan.
 */
export async function setProjectPlan(projectId: string, plan: Plan): Promise<void> {
  await assertAdmin()
  if (!VALID_PLANS.includes(plan)) throw new Error("Invalid plan")

  const supabase = createServiceClient()
  const { data: project, error: readErr } = await supabase
    .from("projects")
    .select("config")
    .eq("id", projectId)
    .single()

  if (readErr || !project) throw new Error("Project not found")

  const config = ((project as { config: unknown }).config ?? {}) as ProjectConfig
  const updated: ProjectConfig = { ...config, plan }

  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin")
}

/**
 * Toggle a project's "public demo" flag. When on, the project is exempt from
 * the per-customer domain allowlist and the /check "try it live" protocol
 * scoping is enabled for its key — independent of plan, so our own demo project
 * can stay on "custom". Admin-guarded; writes projects.config.publicDemo.
 */
export async function setProjectPublicDemo(projectId: string, enabled: boolean): Promise<void> {
  await assertAdmin()

  const supabase = createServiceClient()
  const { data: project, error: readErr } = await supabase
    .from("projects")
    .select("config")
    .eq("id", projectId)
    .single()

  if (readErr || !project) throw new Error("Project not found")

  const config = ((project as { config: unknown }).config ?? {}) as ProjectConfig
  const updated: ProjectConfig = { ...config, publicDemo: enabled }

  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/admin")
}
