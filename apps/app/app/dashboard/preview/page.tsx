import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bookmark, ExternalLink, MonitorSmartphone } from "lucide-react"
import { ConfirmPreviewButton } from "@/components/dashboard/ConfirmPreviewButton"
import type { Database } from "@/lib/supabase/types"
import type { ProjectConfig } from "@/lib/types/config"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function PreviewPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig
  const widgetBaseUrl = process.env.NEXT_PUBLIC_WIDGET_URL ?? "https://app.txid.support"
  const previewUrl = `${widgetBaseUrl}/preview?key=${typedProject.publishable_key}`
  const bookmarklet = `javascript:(function(){if(document.getElementById('txid-preview'))return;var f=document.createElement('iframe');f.id='txid-preview';f.src='${widgetBaseUrl}/widget?key=${typedProject.publishable_key}';f.style.cssText='position:fixed;bottom:20px;right:20px;width:380px;height:580px;border:none;z-index:2147483647;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,0.4)';document.body.appendChild(f);})();`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Preview widget</h1>
        <p className="text-muted-foreground mt-1">
          Test your widget before any users see it, then confirm you&apos;re happy to move on.
        </p>
      </div>

      {/* Standalone preview */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MonitorSmartphone className="size-4 text-muted-foreground" />
            <CardTitle>Standalone preview</CardTitle>
          </div>
          <CardDescription>
            Opens your widget on a branded page at its exact display size.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ExternalLink className="size-4" />
            Open preview
          </a>
        </CardContent>
      </Card>

      {/* Bookmarklet */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bookmark className="size-4 text-muted-foreground" />
            <CardTitle>Preview on your own website</CardTitle>
          </div>
          <CardDescription>
            Test the widget on your actual site without touching any code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3 text-sm text-muted-foreground list-none">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              <span>Drag the purple button below into your browser&apos;s bookmarks bar (the bar just below the address bar)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              <span>Go to your website in the browser — any page you want to test on</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              <span>Click the bookmark — your support widget appears in the bottom-right corner, exactly as users will see it. Refresh the page to remove it.</span>
            </li>
          </ol>

          <div className="flex items-center gap-4 pt-2">
            {/* eslint-disable-next-line react/jsx-no-script-url */}
            <a
              href={bookmarklet}
              onClick={e => e.preventDefault()}
              draggable
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground cursor-grab active:cursor-grabbing select-none"
              title="Drag this to your bookmarks bar"
            >
              <Bookmark className="size-4" />
              TxID Preview
            </a>
            <p className="text-xs text-muted-foreground">← drag this to your bookmarks bar</p>
          </div>
        </CardContent>
      </Card>

      {/* Confirm */}
      <Card className={config.previewConfirmed ? "border-green-500/30 bg-green-500/5" : "border-primary/30 bg-primary/5"}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="font-semibold">
                {config.previewConfirmed ? "✓ Preview approved" : "Happy with how it looks?"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {config.previewConfirmed
                  ? "You confirmed the design. Head to Embed & Go Live to publish."
                  : "Once you've tested the widget and you're happy with it, confirm here to move to the final step."}
              </p>
            </div>
            <ConfirmPreviewButton
              projectId={typedProject.id}
              confirmed={config.previewConfirmed}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
