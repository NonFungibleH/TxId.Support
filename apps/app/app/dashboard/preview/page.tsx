import { getProject } from "@/lib/actions/project"
import { generatePreviewToken } from "@/lib/preview-token"
import { redirect } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Bookmark, ExternalLink, MonitorSmartphone } from "lucide-react"
import { ConfirmPreviewButton } from "@/components/dashboard/ConfirmPreviewButton"
import { BookmarkletButton } from "@/components/dashboard/BookmarkletButton"
import type { Database } from "@/lib/supabase/types"
import type { ProjectConfig } from "@/lib/types/config"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function PreviewPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  // config may be null for projects created before this field was introduced
  const rawConfig = typedProject.config as unknown as ProjectConfig | null
  const previewConfirmed = rawConfig?.previewConfirmed ?? false
  const widgetBaseUrl = process.env.NEXT_PUBLIC_WIDGET_URL ?? "https://app.txid.support"
  const pt = generatePreviewToken(typedProject.id)
  const previewUrl = `${widgetBaseUrl}/preview?key=${typedProject.publishable_key}&preview=1&pt=${pt}`
  // Injects the real loader rather than a bare iframe. The loader runs on the
  // host page, which is top level, so it can drive the wallet extension on the
  // widget's behalf: an extension cannot show its approval popup for a
  // cross-origin iframe, so a bare iframe leaves Connect wallet permanently
  // dead. This also makes the preview behave exactly like a live install.
  const bookmarklet = `javascript:(function(){if(document.getElementById('txid-widget-root')||document.getElementById('txid-widget-script'))return;var s=document.createElement('script');s.id='txid-widget-script';s.src='${widgetBaseUrl}/widget.js';s.setAttribute('data-key','${typedProject.publishable_key}');s.setAttribute('data-preview','1');s.setAttribute('data-pt','${pt}');document.body.appendChild(s);})();`

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
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Recommended
            </span>
          </div>
          <CardDescription>
            Opens your widget on a branded page at its exact display size. This is the reliable way to test it: it works in any browser, on any network, and you can share the link with your team.
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
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Optional
            </span>
          </div>
          <CardDescription>
            Test the widget on your actual site without touching any code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Heads up: this trick works by injecting the widget into the page, so a site with a strict Content Security Policy will block it. Most DeFi apps have one. If you click the bookmark and nothing appears, that is why, and there is no error to see. Use the standalone preview above instead: it works everywhere.
            </p>
          </div>
          <ol className="space-y-3 text-sm text-muted-foreground list-none">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              <span>Drag the purple button below into your browser&apos;s bookmarks bar (the bar just below the address bar)</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              <span>Go to your website in the browser - any page you want to test on</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              <span>Click the bookmark - your support widget appears in the bottom-right corner, exactly as users will see it. Refresh the page to remove it.</span>
            </li>
          </ol>

          <div className="flex items-center gap-4 pt-2">
            <BookmarkletButton href={bookmarklet} />
            <p className="text-xs text-muted-foreground">← drag this to your bookmarks bar</p>
          </div>
        </CardContent>
      </Card>

      {/* Confirm */}
      <Card className={previewConfirmed ? "border-green-500/30 bg-green-500/5" : "border-primary/30 bg-primary/5"}>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between gap-6">
            <div>
              <p className="font-semibold">
                {previewConfirmed ? "✓ Preview approved" : "Happy with how it looks?"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {previewConfirmed
                  ? "You confirmed the design. Head to Embed & Go Live to publish."
                  : "Once you've tested the widget and you're happy with it, confirm here to move to the final step."}
              </p>
            </div>
            <ConfirmPreviewButton
              projectId={typedProject.id}
              confirmed={previewConfirmed}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
