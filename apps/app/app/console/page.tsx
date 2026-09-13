import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { overview, liveSetup } from "@/lib/console/data"
import { setupState } from "@/lib/console/setup"
import { ConsoleOverview } from "@/components/console/ConsoleOverview"
import { ConsoleUnavailable } from "@/components/console/ConsoleUnavailable"
import type { ProjectConfig } from "@/lib/types/config"

export const metadata: Metadata = { title: "Console | TxID" }
export const dynamic = "force-dynamic"

export default async function ConsoleOverviewPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")
  const p = project as unknown as { id: string; config: ProjectConfig | null }
  const [figures, setup] = await Promise.all([overview(p.id), liveSetup(p)])
  if (figures.kind !== "ok") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Console</h1>
          <p className="text-sm text-muted-foreground mt-1">Failed transactions across your contracts, and the customers waiting on them.</p>
        </div>
        <ConsoleUnavailable what="The overview" reason={figures.reason} />
      </div>
    )
  }
  return <ConsoleOverview base="/console" figures={figures.value} setup={setupState(setup, "/console")} />
}
