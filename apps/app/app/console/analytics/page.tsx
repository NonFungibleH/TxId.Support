import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { causeGroups, basisCounts } from "@/lib/console/data"
import { AnalyticsView } from "@/components/console/AnalyticsView"
import { ConsoleUnavailable } from "@/components/console/ConsoleUnavailable"

export const metadata: Metadata = { title: "Analytics | TxID Console" }
export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")
  const projectId = (project as { id: string }).id
  const [causes, basis] = await Promise.all([causeGroups(projectId), basisCounts(projectId)])
  const failed = causes.kind !== "ok" ? causes : basis.kind !== "ok" ? basis : null
  if (failed) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">What is failing, whether it is getting worse, and how much of it we could verify.</p>
        </div>
        <ConsoleUnavailable what="Analytics" reason={failed.reason} />
      </div>
    )
  }
  if (causes.kind !== "ok" || basis.kind !== "ok") return null
  return <AnalyticsView base="/console" causes={causes.value} basis={basis.value} />
}
