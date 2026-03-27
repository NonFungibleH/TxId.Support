import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
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

  const supabase = createServiceClient()
  const { count: docCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", typedProject.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Docs & Knowledge Base</h1>
        <p className="text-muted-foreground mt-1">Feed the AI your protocol documentation.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Knowledge base</CardTitle>
          <CardDescription>
            Indexed content is retrieved via RAG when users ask questions in the widget.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocsForm
            projectId={typedProject.id}
            initialDocsUrl={config.docsUrl}
            docCount={docCount ?? 0}
          />
        </CardContent>
      </Card>
    </div>
  )
}
