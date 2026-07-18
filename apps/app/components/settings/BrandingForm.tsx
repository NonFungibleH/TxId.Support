"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColorPicker } from "./ColorPicker"
import { updateConfig } from "@/lib/actions/project"
import { fetchBrandColors } from "@/lib/actions/brand"
import type { BrandingConfig } from "@/lib/types/config"
import { SUPPORTED_FONTS, PERSONAS, PERSONA_LABELS, FONT_SCALES, FONT_SCALE_LABEL, autoInputTextColor } from "@/lib/types/config"

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
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const hasMountedRef = useRef(false)

  function update<K extends keyof BrandingConfig>(key: K, val: BrandingConfig[K]) {
    setBranding(prev => ({ ...prev, [key]: val }))
  }

  // Notify parent of live changes for preview + debounced auto-save
  useEffect(() => {
    onBrandingChange?.(branding)
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        try {
          await updateConfig(projectId, { branding })
        } catch {
          toast.error("Auto-save failed — click Save to retry")
        }
      })
    }, 800)
    return () => clearTimeout(saveTimeoutRef.current)
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
    <div className="space-y-8">

      {/* ── Design ─────────────────────────────────────── */}
      <div className="space-y-5">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Design</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Control the visual appearance of your widget.</p>
        </div>

        {/* Website + auto-fetch */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Website</h3>
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

        {/* Quick themes */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Quick themes</h3>
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

        {/* Colours */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Colours</h3>
          <ColorPicker value={branding.primaryColor} onChange={v => update("primaryColor", v)} label="Primary" />
          <ColorPicker value={branding.secondaryColor} onChange={v => update("secondaryColor", v)} label="Secondary" />
          <ColorPicker value={branding.backgroundColor} onChange={v => update("backgroundColor", v)} label="Background" />
          <ColorPicker value={branding.textColor} onChange={v => update("textColor", v)} label="Text" />
          <ColorPicker
            value={branding.inputTextColor ?? autoInputTextColor(branding.backgroundColor)}
            onChange={v => update("inputTextColor", v)}
            label="Input text"
          />
          <p className="text-xs text-muted-foreground">Colour of what visitors type. Defaults to auto-contrast with the background so it is never invisible.</p>
        </div>

        {/* Logo */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Logo</h3>
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

        {/* Font + Position side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Font</h3>
            <Select value={branding.font} onValueChange={v => update("font", v as BrandingConfig["font"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_FONTS.map(f => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Position</h3>
            <Select value={branding.position} onValueChange={v => update("position", v as BrandingConfig["position"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bottom-right">Bottom right</SelectItem>
                <SelectItem value="bottom-left">Bottom left</SelectItem>
                <SelectItem value="inline">Inline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Text size</h3>
            <Select value={branding.fontScale ?? "md"} onValueChange={v => update("fontScale", v as BrandingConfig["fontScale"])}>
              <SelectTrigger>
                <SelectValue>{FONT_SCALE_LABEL[branding.fontScale ?? "md"]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {FONT_SCALES.map(s => (
                  <SelectItem key={s} value={s}>{FONT_SCALE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Scales the whole widget so it fits your site. Larger sizes grow the widget too.</p>
          </div>
        </div>
      </div>

      {/* ── Persona ─────────────────────────────────────── */}
      <div className="space-y-5">
        <div className="border-b border-border pb-2">
          <h2 className="text-base font-semibold">Persona</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Define how your AI speaks and presents itself to users.</p>
        </div>

        {/* Tone */}
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Tone</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

        {/* Custom tone of voice */}
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">Custom tone of voice</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Optional. Describe how your bot should talk, in your own words, to keep it on-brand: the personality, warmth, words or phrases to use or avoid, spelling (e.g. British), emoji or none. This layers on top of the tone above. It only shapes wording, never the facts.
            </p>
          </div>
          <textarea
            placeholder="e.g. Warm and a little playful, British spelling, never corporate. Say 'gm' but no other slang. Never use exclamation marks. Refer to the token as $XYZ."
            value={branding.customTone ?? ""}
            onChange={e => update("customTone", e.target.value || null)}
            rows={3}
            maxLength={800}
            className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
          />
        </div>

        {/* Agent name + avatar */}
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">Agent name</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Shown as the widget&apos;s title (and avatar initials). Leave blank to use your project name.</p>
          </div>
          <Input
            placeholder="e.g. Alex, Aria, Support"
            value={branding.agentName ?? ""}
            onChange={e => update("agentName", e.target.value || null)}
          />
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-medium">Avatar URL <span className="text-muted-foreground font-normal">(optional)</span></h3>
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

        {/* Opening message */}
        <div className="space-y-2">
          <div>
            <h3 className="text-sm font-medium">Opening message</h3>
            <p className="text-xs text-muted-foreground mt-0.5">The first message users see. Leave blank for the default greeting.</p>
          </div>
          <Textarea
            placeholder="Hi! I'm here to help. Ask me about the protocol, transactions, or anything else."
            value={branding.welcomeMessage ?? ""}
            onChange={e => update("welcomeMessage", e.target.value || null)}
            rows={3}
            className="text-sm resize-none"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save branding"}
        </Button>
        <p className="text-xs text-muted-foreground">Changes save automatically</p>
      </div>
    </div>
  )
}
