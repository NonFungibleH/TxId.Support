import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { EmbedCodeDisplay } from "@/components/settings/EmbedCodeDisplay"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function EmbedPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Embed & Integration</h1>
        <p className="text-muted-foreground mt-1">Copy the code snippet and paste it into your site.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Embed code</CardTitle>
          <CardDescription>Three ways to integrate — pick whatever fits your stack.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmbedCodeDisplay publishableKey={typedProject.publishable_key} />
        </CardContent>
      </Card>
    </div>
  )
}
