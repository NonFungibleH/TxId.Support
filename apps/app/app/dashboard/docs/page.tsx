import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { DocsForm } from "@/components/settings/DocsForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function DocsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Docs & Knowledge Base</h1>
        <p className="text-muted-foreground mt-1">Feed the AI your protocol documentation.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Documentation source</CardTitle>
          <CardDescription>Paste your public docs URL — we crawl and index it automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <DocsForm projectId={typedProject.id} initialDocsUrl={config.docsUrl} />
        </CardContent>
      </Card>
    </div>
  )
}
