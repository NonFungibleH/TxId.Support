import { getProject } from "@/lib/actions/project"
import { toggleActive } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { EmbedCodeDisplay } from "@/components/settings/EmbedCodeDisplay"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, PauseCircle } from "lucide-react"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function EmbedPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const isActive = typedProject.is_active

  async function toggle() {
    "use server"
    await toggleActive(typedProject.id, !isActive)
    redirect("/dashboard/embed")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Embed & Go Live</h1>
        <p className="text-muted-foreground mt-1">Copy the code snippet and paste it into your site.</p>
      </div>

      {/* Status banner */}
      <div className={[
        "rounded-xl border p-4 flex items-center justify-between gap-4",
        isActive
          ? "bg-green-500/5 border-green-500/20"
          : "bg-muted/40 border-border",
      ].join(" ")}>
        <div className="flex items-center gap-3">
          {isActive ? (
            <CheckCircle2 className="size-5 text-green-500 shrink-0" />
          ) : (
            <PauseCircle className="size-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <p className="text-sm font-semibold">
              {isActive ? "Widget is live" : "Widget is paused"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isActive
                ? "Your widget is active and visible to users. You can pause it at any time from here."
                : "Your widget is paused. Users will not see it until you go live."}
            </p>
          </div>
        </div>
        <form action={toggle}>
          <Button
            type="submit"
            variant={isActive ? "outline" : "default"}
            size="sm"
            className="shrink-0"
          >
            {isActive ? "Pause widget" : "Go live"}
          </Button>
        </form>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Embed code</CardTitle>
          <CardDescription>Three ways to integrate — pick whatever fits your stack.</CardDescription>
        </CardHeader>
        <CardContent>
          <EmbedCodeDisplay
            publishableKey={typedProject.publishable_key}
            widgetBaseUrl={process.env.NEXT_PUBLIC_WIDGET_URL ?? "https://app.txid.support"}
          />
        </CardContent>
      </Card>
    </div>
  )
}
