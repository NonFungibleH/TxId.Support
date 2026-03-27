import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { CommunityForm } from "@/components/settings/CommunityForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function CommunityPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Community</h1>
        <p className="text-muted-foreground mt-1">Social links and announcements shown in the widget.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Community links</CardTitle>
          <CardDescription>Leave blank to hide a link from the widget.</CardDescription>
        </CardHeader>
        <CardContent>
          <CommunityForm projectId={typedProject.id} initial={config.community ?? null} />
        </CardContent>
      </Card>
    </div>
  )
}
