"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { updateConfig } from "@/lib/actions/project"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import type { ChainId } from "@/lib/types/config"

interface ChainTogglesProps {
  projectId: string
  initialChains: ChainId[]
}

export function ChainToggles({ projectId, initialChains }: ChainTogglesProps) {
  const [chains, setChains] = useState<ChainId[]>(initialChains)
  const [isPending, startTransition] = useTransition()

  function toggle(chainId: ChainId) {
    setChains(prev =>
      prev.includes(chainId)
        ? prev.filter(c => c !== chainId)
        : [...prev, chainId]
    )
  }

  function save() {
    if (chains.length === 0) {
      toast.error("At least one chain must be enabled")
      return
    }
    startTransition(async () => {
      try {
        await updateConfig(projectId, { chains })
        toast.success("Chain settings saved")
      } catch {
        toast.error("Failed to save chain settings")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {SUPPORTED_CHAINS.map(chain => (
          <div key={chain.id} className="flex items-center justify-between py-1">
            <div>
              <Label htmlFor={`chain-${chain.id}`} className="text-sm font-medium">{chain.name}</Label>
              <p className="text-xs text-muted-foreground">{chain.explorer}</p>
            </div>
            <Switch
              id={`chain-${chain.id}`}
              checked={chains.includes(chain.id as ChainId)}
              onCheckedChange={() => toggle(chain.id as ChainId)}
            />
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save chains"}
      </Button>
    </div>
  )
}
