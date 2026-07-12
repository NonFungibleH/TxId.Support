"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { updateConfig } from "@/lib/actions/project"
import type { TokenConfig } from "@/lib/types/config"

interface TokenCardToggleProps {
  projectId: string
  token: TokenConfig
}

/**
 * Controls whether the protocol's token shows as a card in the widget's Content
 * tab. The token itself is configured on the Smart Contracts page and always
 * powers the AI; this only affects the widget display.
 */
export function TokenCardToggle({ projectId, token }: TokenCardToggleProps) {
  const [shown, setShown] = useState(token.showInWidget === true)
  const [isPending, startTransition] = useTransition()

  function toggle(next: boolean) {
    setShown(next) // optimistic
    startTransition(async () => {
      try {
        await updateConfig(projectId, { token: { ...token, showInWidget: next } })
        toast.success(next ? "Token card shown in widget" : "Token card hidden")
      } catch {
        setShown(!next) // revert
        toast.error("Failed to update token card")
      }
    })
  }

  const label = token.symbol ? `${token.symbol} token card` : "Token card"

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
      <div>
        <Label htmlFor="token-card" className="cursor-pointer">Show {label} in the widget</Label>
        <p className="text-xs text-muted-foreground mt-0.5">
          Displays a token card (symbol + Buy link) in the widget&apos;s Content tab. Your token still powers live price and token answers in the AI either way.
        </p>
      </div>
      <Switch id="token-card" checked={shown} disabled={isPending} onCheckedChange={toggle} />
    </div>
  )
}
