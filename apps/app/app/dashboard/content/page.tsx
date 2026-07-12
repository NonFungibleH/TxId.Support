import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import Link from "next/link"
import { ContentBlockEditor } from "@/components/settings/ContentBlockEditor"
import { TokenCardToggle } from "@/components/settings/TokenCardToggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function ContentPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Content Menu</h1>
        <p className="text-muted-foreground mt-1">Add content blocks to the Content tab in your widget. Drag to reorder.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Token card</CardTitle>
          <CardDescription>
            Show your protocol&apos;s token in the widget&apos;s Content tab, or keep it AI-only.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {config.token ? (
            <TokenCardToggle projectId={typedProject.id} token={config.token} />
          ) : (
            <p className="text-sm text-muted-foreground">
              No token set yet. Add your token under{" "}
              <Link href="/dashboard/contracts" className="font-medium text-foreground underline underline-offset-2">
                Smart Contracts
              </Link>{" "}
              to show it here.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Content blocks</CardTitle>
          <CardDescription>Maximum 10 blocks. Drag to reorder.</CardDescription>
        </CardHeader>
        <CardContent>
          <ContentBlockEditor projectId={typedProject.id} initialBlocks={config.contentBlocks} />
        </CardContent>
      </Card>
    </div>
  )
}
