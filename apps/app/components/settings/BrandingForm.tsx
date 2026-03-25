"use client"

import { useState, useTransition, useEffect } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColorPicker } from "./ColorPicker"
import { updateConfig } from "@/lib/actions/project"
import type { BrandingConfig } from "@/lib/types/config"
import { SUPPORTED_FONTS } from "@/lib/types/config"
import { Separator } from "@/components/ui/separator"

interface BrandingFormProps {
  projectId: string
  initial: BrandingConfig
  onBrandingChange?: (branding: BrandingConfig) => void
}

export function BrandingForm({ projectId, initial, onBrandingChange }: BrandingFormProps) {
  const [branding, setBranding] = useState<BrandingConfig>(initial)
  const [isPending, startTransition] = useTransition()

  function update<K extends keyof BrandingConfig>(key: K, val: BrandingConfig[K]) {
    setBranding(prev => ({ ...prev, [key]: val }))
  }

  // Notify parent of live branding changes for preview
  useEffect(() => {
    onBrandingChange?.(branding)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(branding)])

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { branding })
        toast.success("Branding saved")
      } catch {
        toast.error("Failed to save branding")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Colours</h3>
        <ColorPicker value={branding.primaryColor} onChange={v => update("primaryColor", v)} label="Primary" />
        <ColorPicker value={branding.secondaryColor} onChange={v => update("secondaryColor", v)} label="Secondary" />
        <ColorPicker value={branding.backgroundColor} onChange={v => update("backgroundColor", v)} label="Background" />
        <ColorPicker value={branding.textColor} onChange={v => update("textColor", v)} label="Text" />
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Typography</h3>
        <div className="flex items-center gap-3">
          <Label className="w-20 shrink-0">Font</Label>
          <Select value={branding.font} onValueChange={v => update("font", v as BrandingConfig["font"])}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_FONTS.map(f => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Widget</h3>
        <div className="flex items-center gap-3">
          <Label className="w-20 shrink-0">Position</Label>
          <Select value={branding.position} onValueChange={v => update("position", v as BrandingConfig["position"])}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="bottom-right">Bottom right</SelectItem>
              <SelectItem value="bottom-left">Bottom left</SelectItem>
              <SelectItem value="inline">Inline</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Label className="w-20 shrink-0">Theme</Label>
          <Select value={branding.theme} onValueChange={v => update("theme", v as BrandingConfig["theme"])}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="light">Light</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save branding"}
      </Button>
    </div>
  )
}
