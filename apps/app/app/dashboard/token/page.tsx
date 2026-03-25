import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { TokenForm } from "@/components/settings/TokenForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function TokenPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Token Settings</h1>
        <p className="text-muted-foreground mt-1">Connect your token so users can see live price and buy directly from the widget.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Token contract</CardTitle>
          <CardDescription>Price and chart data is fetched automatically via DexScreener.</CardDescription>
        </CardHeader>
        <CardContent>
          <TokenForm projectId={typedProject.id} initial={config.token} />
        </CardContent>
      </Card>
    </div>
  )
}
