"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { updateConfig } from "@/lib/actions/project"
import type { TokenConfig } from "@/lib/types/config"
import { SELECTABLE_CHAINS } from "@/lib/types/config"

interface TokenFormProps {
  projectId: string
  initial: TokenConfig | null
}

export function TokenForm({ projectId, initial }: TokenFormProps) {
  const [address, setAddress] = useState(initial?.address ?? "")
  const [chain, setChain] = useState<TokenConfig["chain"]>(initial?.chain ?? "0x1")
  const [dexUrl, setDexUrl] = useState(initial?.dexUrl ?? "")
  const [showInWidget, setShowInWidget] = useState(initial?.showInWidget !== false)
  const [isPending, startTransition] = useTransition()

  function save() {
    if (!address.trim()) {
      toast.error("Token address is required")
      return
    }
    startTransition(async () => {
      try {
        await updateConfig(projectId, {
          token: {
            address: address.trim().toLowerCase(),
            chain: chain as TokenConfig["chain"],
            dexUrl: dexUrl.trim() || null,
            symbol: null,
            name: null,
            showInWidget,
          },
        })
        toast.success("Token settings saved")
      } catch {
        toast.error("Failed to save token settings")
      }
    })
  }

  function clear() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { token: null })
        setAddress("")
        setDexUrl("")
        toast.success("Token removed")
      } catch {
        toast.error("Failed to remove token")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="token-address">Token contract address</Label>
        <Input
          id="token-address"
          placeholder="0x..."
          value={address}
          onChange={e => setAddress(e.target.value)}
          className="font-mono"
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="token-chain">Chain</Label>
        <Select value={chain} onValueChange={v => setChain(v as TokenConfig["chain"])}>
          <SelectTrigger id="token-chain" className="w-64">
            <SelectValue>
              {SELECTABLE_CHAINS.find(c => c.id === chain)?.name ?? chain}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SELECTABLE_CHAINS.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="dex-url">DEX link (optional)</Label>
        <Input
          id="dex-url"
          placeholder="https://app.uniswap.org/..."
          value={dexUrl}
          onChange={e => setDexUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">The &quot;Buy Token&quot; button will open this URL.</p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2.5">
        <div>
          <Label htmlFor="token-show" className="cursor-pointer">Show token card in the widget</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Displays a token card (symbol + Buy link) in the widget&apos;s Content tab. The token still powers live price and token answers either way.</p>
        </div>
        <Switch id="token-show" checked={showInWidget} onCheckedChange={setShowInWidget} />
      </div>

      <div className="flex gap-2">
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save token"}
        </Button>
        {initial && (
          <Button variant="outline" onClick={clear} disabled={isPending}>
            Remove token
          </Button>
        )}
      </div>
    </div>
  )
}
