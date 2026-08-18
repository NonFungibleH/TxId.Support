"use client"

import { useState } from "react"
import { BrandingForm, type BrandingSection } from "./BrandingForm"
import { WidgetPreview } from "@/components/dashboard/WidgetPreview"
import type { BrandingConfig } from "@/lib/types/config"
import { themedBranding } from "@/lib/types/config"

/**
 * Form on the left, live widget on the right. Shared by Branding and Persona:
 * the preview already reacts to agent name, avatar and opening message, so the
 * persona fields are exactly the ones you most want to see while you edit them.
 *
 * `children` renders UNDER the form, in the left column, so a page can add its
 * own cards without losing the sticky preview beside them.
 */
export function BrandingPageClient({
  projectId,
  projectName,
  initial,
  section,
  children,
}: {
  projectId: string
  projectName: string
  initial: BrandingConfig
  section: BrandingSection
  children?: React.ReactNode
}) {
  // Live branding state driven by the form
  const [liveBranding, setLiveBranding] = useState<BrandingConfig>(initial)
  // Which palette the preview shows. Only offered once a dark theme exists;
  // the widget itself resolves this from the visitor/host at runtime.
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light")

  const hasDark = !!liveBranding.darkTheme
  const previewBranding = themedBranding(liveBranding, hasDark ? previewTheme : "light")

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <BrandingForm
          projectId={projectId}
          initial={initial}
          section={section}
          onBrandingChange={setLiveBranding}
        />
        {children}
      </div>
      <div className="lg:sticky lg:top-6 lg:self-start">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Preview</p>
          {hasDark && (
            <div className="flex rounded-lg border border-border p-0.5">
              {(["light", "dark"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setPreviewTheme(t)}
                  className={[
                    "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors",
                    previewTheme === t ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>
        <WidgetPreview branding={previewBranding} projectName={projectName} />
      </div>
    </div>
  )
}
