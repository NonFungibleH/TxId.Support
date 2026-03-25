import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { ChainToggles } from "@/components/settings/ChainToggles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function ChainsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

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
          <ChainToggles projectId={typedProject.id} initialChains={config.chains} />
        </CardContent>
      </Card>
    </div>
  )
}
