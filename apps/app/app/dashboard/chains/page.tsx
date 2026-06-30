import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { ChainToggles } from "@/components/settings/ChainToggles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import { PLAN_CHAIN_LIMITS } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function ChainsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig
  const supabase = createServiceClient()

  // Count conversations per chain (all-time) for usage badges
  const { data: chainConvs } = await supabase
    .from("conversations")
    .select("chain_id")
    .eq("project_id", typedProject.id)
    .not("chain_id", "is", null)

  const chainUsage: Record<string, number> = {}
  for (const row of chainConvs ?? []) {
    const id = row.chain_id as string
    if (id) chainUsage[id] = (chainUsage[id] ?? 0) + 1
  }

  const plan = config.plan ?? "starter"
  // Infinity cannot cross the server→client boundary (JSON.stringify → null), use -1 as sentinel
  const chainLimitRaw = PLAN_CHAIN_LIMITS[plan]
  const chainLimit = chainLimitRaw === Infinity ? -1 : chainLimitRaw

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Supported Chains</h1>
        <p className="text-muted-foreground mt-1">Choose which chains the widget checks when scanning wallets.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active chains</CardTitle>
          <CardDescription>Toggle which chains are included in wallet history lookups.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChainToggles
            projectId={typedProject.id}
            initialChains={config.chains}
            chainUsage={chainUsage}
            plan={plan}
            chainLimit={chainLimit}  // -1 = unlimited
          />
        </CardContent>
      </Card>
    </div>
  )
}
