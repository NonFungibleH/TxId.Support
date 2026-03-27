import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { AskForm } from "@/components/settings/AskForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function AskPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Ask AI</h1>
        <p className="text-muted-foreground mt-1">
          Context injected into the AI when users ask questions in the widget.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Project FAQ</CardTitle>
          <CardDescription>
            Plain text — no embedding required. This is injected directly into the AI system prompt.
            Max ~2,000 characters.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AskForm projectId={typedProject.id} initial={config.tokenModeAsk ?? ""} />
        </CardContent>
      </Card>
    </div>
  )
}
