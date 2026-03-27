"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateConfig } from "@/lib/actions/project"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { CommunityConfig } from "@/lib/types/config"

const FIELDS: { key: keyof Omit<CommunityConfig, "announcement">; label: string; placeholder: string }[] = [
  { key: "discord",    label: "Discord",    placeholder: "https://discord.gg/..." },
  { key: "twitter",    label: "Twitter/X",  placeholder: "https://x.com/..." },
  { key: "telegram",   label: "Telegram",   placeholder: "https://t.me/..." },
  { key: "website",    label: "Website",    placeholder: "https://yourprotocol.com" },
  { key: "whitepaper", label: "Whitepaper", placeholder: "https://yourprotocol.com/whitepaper.pdf" },
]

export function CommunityForm({
  projectId,
  initial,
}: {
  projectId: string
  initial: CommunityConfig | null
}) {
  const [values, setValues] = useState<CommunityConfig>({
    discord:      initial?.discord      ?? null,
    twitter:      initial?.twitter      ?? null,
    telegram:     initial?.telegram     ?? null,
    website:      initial?.website      ?? null,
    whitepaper:   initial?.whitepaper   ?? null,
    announcement: initial?.announcement ?? null,
  })
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { community: values })
        toast.success("Community links saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  return (
    <div className="space-y-4">
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key} className="grid gap-1.5">
          <Label htmlFor={key}>{label}</Label>
          <Input
            id={key}
            type="url"
            placeholder={placeholder}
            value={values[key] ?? ""}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value || null }))}
          />
        </div>
      ))}
      <div className="grid gap-1.5">
        <Label htmlFor="announcement">
          Announcement <span className="text-muted-foreground">(optional)</span>
        </Label>
        <textarea
          id="announcement"
          rows={3}
          placeholder="e.g. V2 is live — check out the new staking pools!"
          value={values.announcement ?? ""}
          onChange={(e) => setValues((v) => ({ ...v, announcement: e.target.value || null }))}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
        />
      </div>
      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save"}
      </Button>
    </div>
  )
}
