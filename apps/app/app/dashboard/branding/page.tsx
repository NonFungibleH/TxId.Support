import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { BrandingForm } from "@/components/settings/BrandingForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function BrandingPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branding & Appearance</h1>
        <p className="text-muted-foreground mt-1">Customise how your widget looks on your site.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Widget appearance</CardTitle>
          <CardDescription>Changes take effect immediately for all users.</CardDescription>
        </CardHeader>
        <CardContent>
          <BrandingForm projectId={typedProject.id} initial={config.branding} />
        </CardContent>
      </Card>
    </div>
  )
}
