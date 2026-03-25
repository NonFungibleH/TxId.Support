"use client"

import { useState } from "react"
import { BrandingForm } from "./BrandingForm"
import { WidgetPreview } from "@/components/dashboard/WidgetPreview"
import type { BrandingConfig } from "@/lib/types/config"

export function BrandingPageClient({
  projectId,
  projectName,
  initial,
}: {
  projectId: string
  projectName: string
  initial: BrandingConfig
}) {
  // Live branding state driven by the form
  const [liveBranding, setLiveBranding] = useState<BrandingConfig>(initial)

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
      <BrandingForm
        projectId={projectId}
        initial={initial}
        onBrandingChange={setLiveBranding}
      />
      <div className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs text-muted-foreground">Preview</p>
        <WidgetPreview branding={liveBranding} projectName={projectName} />
      </div>
    </div>
  )
}
