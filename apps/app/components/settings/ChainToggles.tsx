"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
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
      <div className="space-y-2">
        {SUPPORTED_CHAINS.map(chain => {
          const enabled = chains.includes(chain.id as ChainId)
          return (
            <button
              key={chain.id}
              type="button"
              onClick={() => toggle(chain.id as ChainId)}
              className="flex items-center justify-between w-full rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent/50"
              style={{ borderColor: enabled ? "rgba(99,102,241,0.5)" : undefined }}
            >
              <div>
                <p className="text-sm font-medium">{chain.name}</p>
                <p className="text-xs text-muted-foreground">{chain.explorer}</p>
              </div>
              <div
                className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
                style={{ backgroundColor: enabled ? "#6366f1" : "rgba(255,255,255,0.15)" }}
              >
                <span
                  className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
                  style={{
                    transform: enabled ? "translate(18px, 2px)" : "translate(2px, 2px)",
                  }}
                />
              </div>
            </button>
          )
        })}
      </div>
      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save chains"}
      </Button>
    </div>
  )
}
