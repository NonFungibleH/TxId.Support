"use client"

import { useState, useTransition, useEffect } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColorPicker } from "./ColorPicker"
import { updateConfig } from "@/lib/actions/project"
import { fetchBrandColors } from "@/lib/actions/brand"
import type { BrandingConfig } from "@/lib/types/config"
import { SUPPORTED_FONTS, PERSONAS, PERSONA_LABELS } from "@/lib/types/config"
import { Separator } from "@/components/ui/separator"

type ColorPreset = Pick<BrandingConfig, "primaryColor" | "secondaryColor" | "backgroundColor" | "textColor">
const PRESETS: Array<{ name: string } & ColorPreset> = [
  { name: "Dark",    primaryColor: "#6366f1", secondaryColor: "#4f46e5", backgroundColor: "#0f0f0f", textColor: "#ffffff" },
  { name: "Light",   primaryColor: "#6366f1", secondaryColor: "#4f46e5", backgroundColor: "#ffffff", textColor: "#111827" },
  { name: "Navy",    primaryColor: "#3b82f6", secondaryColor: "#1d4ed8", backgroundColor: "#0f172a", textColor: "#f1f5f9" },
  { name: "Emerald", primaryColor: "#10b981", secondaryColor: "#059669", backgroundColor: "#0a1512", textColor: "#ecfdf5" },
  { name: "Violet",  primaryColor: "#a78bfa", secondaryColor: "#7c3aed", backgroundColor: "#0d0a1a", textColor: "#f5f3ff" },
]

interface BrandingFormProps {
  projectId: string
  initial: BrandingConfig
  onBrandingChange?: (branding: BrandingConfig) => void
}

export function BrandingForm({ projectId, initial, onBrandingChange }: BrandingFormProps) {
  const [branding, setBranding] = useState<BrandingConfig>(initial)
  const [isPending, startTransition] = useTransition()
  const [fetchingColors, setFetchingColors] = useState(false)
  const [colorFetchMsg, setColorFetchMsg] = useState<{ ok: boolean; text: string } | null>(null)

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

  function applyPreset(preset: ColorPreset) {
    setBranding(prev => ({ ...prev, ...preset }))
  }

  async function handleFetchColors() {
    if (!branding.websiteUrl) return
    setFetchingColors(true)
    setColorFetchMsg(null)
    try {
      const result = await fetchBrandColors(branding.websiteUrl)
      if (result.error) {
        setColorFetchMsg({ ok: false, text: result.error })
      } else {
        setBranding(prev => ({
          ...prev,
          ...(result.primaryColor    ? { primaryColor:    result.primaryColor }    : {}),
          ...(result.secondaryColor  ? { secondaryColor:  result.secondaryColor }  : {}),
          ...(result.backgroundColor ? { backgroundColor: result.backgroundColor } : {}),
          ...(result.textColor       ? { textColor:       result.textColor }       : {}),
        }))
        setColorFetchMsg({
          ok: true,
          text: `Found via ${result.foundSignals.join(", ")} — colours applied below. Tweak as needed.`,
        })
      }
    } finally {
      setFetchingColors(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Website URL + auto colour extraction */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Website</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter your website to auto-fetch brand colours.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://yourprotocol.com"
            value={branding.websiteUrl ?? ""}
            onChange={e => update("websiteUrl", e.target.value || null)}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFetchColors}
            disabled={!branding.websiteUrl || fetchingColors}
            className="shrink-0 gap-1.5"
          >
            {fetchingColors
              ? <><Loader2 className="size-3.5 animate-spin" /> Fetching…</>
              : "Fetch colours"
            }
          </Button>
        </div>
        {colorFetchMsg && (
          <p className={`text-xs ${colorFetchMsg.ok ? "text-green-500" : "text-destructive"}`}>
            {colorFetchMsg.text}
          </p>
        )}
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Quick themes</h3>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(preset => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors hover:opacity-90"
              style={{
                backgroundColor: preset.backgroundColor,
                color: preset.textColor,
                borderColor: `${preset.primaryColor}60`,
              }}
            >
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: preset.primaryColor }} />
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Colours</h3>
        <ColorPicker value={branding.primaryColor} onChange={v => update("primaryColor", v)} label="Primary" />
        <ColorPicker value={branding.secondaryColor} onChange={v => update("secondaryColor", v)} label="Secondary" />
        <ColorPicker value={branding.backgroundColor} onChange={v => update("backgroundColor", v)} label="Background" />
        <ColorPicker value={branding.textColor} onChange={v => update("textColor", v)} label="Text" />
      </div>

      <Separator />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Logo</h3>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Logo URL (shown in widget header)</Label>
          <Input
            type="url"
            placeholder="https://yourprotocol.com/logo.png"
            value={branding.logoUrl ?? ""}
            onChange={e => update("logoUrl", e.target.value || null)}
            className="font-mono text-sm"
          />
          {branding.logoUrl && (
            <div className="flex items-center gap-3 pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding.logoUrl}
                alt="Logo preview"
                className="h-8 w-auto max-w-[120px] rounded object-contain"
                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
              />
              <span className="text-xs text-muted-foreground">Preview</span>
            </div>
          )}
        </div>
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
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Bot persona</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Controls how the AI communicates with your users.</p>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {PERSONAS.map(p => {
            const { name, tagline } = PERSONA_LABELS[p]
            const active = (branding.persona ?? "concise") === p
            return (
              <button
                key={p}
                type="button"
                onClick={() => update("persona", p)}
                className={[
                  "flex flex-col items-start gap-0.5 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border hover:border-muted-foreground text-muted-foreground hover:text-foreground",
                ].join(" ")}
              >
                <span className="text-xs font-medium">{name}</span>
                <span className="text-[11px] leading-tight opacity-70">{tagline}</span>
              </button>
            )
          })}
        </div>
      </div>

      <Separator />

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">AI agent identity</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Give the AI a name and avatar — users will see this instead of "AI".</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Name (e.g. Alex, Aria, Support)</Label>
          <Input
            placeholder="AI"
            value={branding.agentName ?? ""}
            onChange={e => update("agentName", e.target.value || null)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Avatar URL (optional)</Label>
          <Input
            type="url"
            placeholder="https://yourprotocol.com/avatar.png"
            value={branding.agentIconUrl ?? ""}
            onChange={e => update("agentIconUrl", e.target.value || null)}
            className="font-mono text-sm"
          />
          {branding.agentIconUrl && (
            <div className="flex items-center gap-3 pt-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={branding.agentIconUrl}
                alt="Avatar preview"
                className="size-8 rounded-full object-cover"
                onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
              />
              <span className="text-xs text-muted-foreground">Preview</span>
            </div>
          )}
        </div>
      </div>

      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save branding"}
      </Button>
    </div>
  )
}
