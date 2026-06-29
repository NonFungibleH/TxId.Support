"use client"

import { useState, useTransition, useRef } from "react"
import { toast } from "sonner"
import { AlertCircle } from "lucide-react"
import { updateConfig } from "@/lib/actions/project"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import type { ChainId } from "@/lib/types/config"

// Chains stored in DB may be hex ("0x1") or decimal ("1") — support both
const CHAIN_LOGOS: Record<string, string> = {
  "0xaa36a7": "/chains/Ethereum.png",
  "0x1":      "/chains/Ethereum.png",
  "0x2105":   "/chains/Base.png",
  "0x38":     "/chains/BNB.png",
  "0x89":     "/chains/Polygon.png",
  "0xa4b1":   "/chains/Arbitrum.png",
  "0xa":      "/chains/Optimism.png",
}

const TESTNETS = new Set(["0xaa36a7"])

const MAINNETS = SUPPORTED_CHAINS.filter(c => !TESTNETS.has(c.id))
const TESTNET_CHAINS = SUPPORTED_CHAINS.filter(c => TESTNETS.has(c.id))

interface ChainTogglesProps {
  projectId: string
  initialChains: ChainId[]
  chainUsage: Record<string, number>
}

export function ChainToggles({ projectId, initialChains, chainUsage }: ChainTogglesProps) {
  const [chains, setChains] = useState<ChainId[]>(initialChains)
  const [, startTransition] = useTransition()
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  const activeMainnets = MAINNETS.filter(c => chains.includes(c.id as ChainId)).length

  function toggle(chainId: ChainId) {
    setChains(prev => {
      const next = prev.includes(chainId)
        ? prev.filter(c => c !== chainId)
        : [...prev, chainId]

      // Debounced auto-save
      clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        const mainnetCount = MAINNETS.filter(c => next.includes(c.id as ChainId)).length
        if (mainnetCount === 0 && !TESTNETS.has(chainId)) {
          toast.error("At least one mainnet chain must be enabled")
          return
        }
        startTransition(async () => {
          try {
            await updateConfig(projectId, { chains: next })
          } catch {
            toast.error("Failed to save chain settings")
          }
        })
      }, 500)

      return next
    })
  }

  function ChainRow({ chain }: { chain: typeof SUPPORTED_CHAINS[number] }) {
    const enabled = chains.includes(chain.id as ChainId)
    const usage = chainUsage[chain.id] ?? 0
    const logo = CHAIN_LOGOS[chain.id]

    return (
      <button
        type="button"
        onClick={() => toggle(chain.id as ChainId)}
        className="flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent/40"
        style={{ borderColor: enabled ? "rgba(99,102,241,0.5)" : undefined }}
      >
        {/* Chain logo */}
        <div className="size-8 shrink-0 rounded-full overflow-hidden bg-muted flex items-center justify-center">
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt={chain.name} className="size-full object-contain p-0.5" />
            : <span className="text-[10px] font-bold opacity-50">{chain.name.slice(0, 2).toUpperCase()}</span>
          }
        </div>

        {/* Name + explorer */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{chain.name}</p>
          <p className="text-xs text-muted-foreground">{chain.explorer}</p>
        </div>

        {/* Usage badge */}
        {usage > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {usage.toLocaleString()} {usage === 1 ? "convo" : "convos"}
          </span>
        )}

        {/* Toggle */}
        <div
          className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200"
          style={{ backgroundColor: enabled ? "#6366f1" : "rgba(255,255,255,0.15)" }}
        >
          <span
            className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
            style={{ transform: enabled ? "translate(18px, 2px)" : "translate(2px, 2px)" }}
          />
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* All-mainnets-off warning */}
      {activeMainnets === 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="size-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-500">
            No mainnet chains are active. Wallet scanning won&apos;t work until you enable at least one.
          </p>
        </div>
      )}

      {/* Mainnets */}
      <div className="space-y-2">
        {MAINNETS.map(chain => <ChainRow key={chain.id} chain={chain} />)}
      </div>

      {/* Testnets — collapsible section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Testnets</p>
        <div className="space-y-2">
          {TESTNET_CHAINS.map(chain => <ChainRow key={chain.id} chain={chain} />)}
        </div>
      </div>

      <p className="text-xs text-muted-foreground">Changes save automatically.</p>
    </div>
  )
}
