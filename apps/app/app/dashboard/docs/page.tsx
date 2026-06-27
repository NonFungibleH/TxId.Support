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

  // Fetch all source URLs and group client-side (sources are typically few dozen at most)
  const { data: docs } = await supabase
    .from("documents")
    .select("source_url, created_at")
    .eq("project_id", typedProject.id)

  const sourcesMap = new Map<string, { count: number; lastIndexedAt: string }>()
  let nullCount = 0
  let nullLastIndexed = ""
  for (const doc of docs ?? []) {
    if (doc.source_url) {
      const existing = sourcesMap.get(doc.source_url)
      const latest = !existing || doc.created_at > existing.lastIndexedAt ? doc.created_at : existing.lastIndexedAt
      sourcesMap.set(doc.source_url, { count: (existing?.count ?? 0) + 1, lastIndexedAt: latest })
    } else {
      nullCount++
      if (doc.created_at > nullLastIndexed) nullLastIndexed = doc.created_at
    }
  }
  const sources = Array.from(sourcesMap.entries()).map(([url, { count, lastIndexedAt }]) => ({ url, count, lastIndexedAt }))
  const totalChunks = (docs ?? []).length

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
            docCount={totalChunks}
            pastedChunkCount={nullCount}
            sources={sources}
            pastedLastIndexedAt={nullLastIndexed}
            voyageKeySet={!!process.env.VOYAGE_API_KEY}
          />
        </CardContent>
      </Card>
    </div>
  )
}
