import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { ActionsForm } from "@/components/settings/ActionsForm"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { isPaidPlan } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function ActionsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig
  const plan = (config.plan ?? "free") as Plan
  const eligible = isPaidPlan(plan) && plan !== "demo" && config.publicDemo !== true

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Actions</h1>
        <p className="text-muted-foreground mt-1">
          Let the assistant prepare transactions your users sign in their own wallet: swaps, staking, claims, and any contract function you enable. Off by default. TxID never holds funds and takes no fee.
        </p>
      </div>
      <ActionsForm
        projectId={typedProject.id}
        initial={config.actions ?? null}
        contracts={(config.watchedContracts ?? []).map(c => ({ id: c.id, name: c.name, chain: c.chain, abi: c.abi ?? null }))}
        eligible={eligible}
      />
    </div>
  )
}
