"use client"

import { useState, useTransition, useRef } from "react"
import { toast } from "sonner"
import Link from "next/link"
import { AlertCircle, Lock } from "lucide-react"
import { updateConfig } from "@/lib/actions/project"
import { SUPPORTED_CHAINS } from "@/lib/types/config"
import type { ChainId, Plan } from "@/lib/types/config"

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
  plan: Plan
  chainLimit: number  // -1 = unlimited (enterprise); Infinity cannot cross the server→client boundary
}

export function ChainToggles({ projectId, initialChains, chainUsage, plan, chainLimit }: ChainTogglesProps) {
  const [chains, setChains] = useState<ChainId[]>(initialChains)
  const [, startTransition] = useTransition()
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  const activeMainnets = MAINNETS.filter(c => chains.includes(c.id as ChainId)).length
  const atLimit = chainLimit !== -1 && activeMainnets >= chainLimit
  const limitLabel = chainLimit === -1 ? String(MAINNETS.length) : String(chainLimit)

  const upgradeLabel = plan === "free" || plan === "starter"
    ? "Upgrade to Pro to enable up to 3 chains"
    : "Contact us to enable more chains"

  function toggle(chainId: ChainId) {
    const isEnabled = chains.includes(chainId)
    const isTestnet = TESTNETS.has(chainId)

    // Block enabling beyond plan limit
    if (!isEnabled && !isTestnet && atLimit) {
      toast.error(upgradeLabel)
      return
    }

    // Block disabling the last mainnet — validate before state update so DB and UI stay in sync
    if (isEnabled && !isTestnet) {
      const currentMainnets = MAINNETS.filter(c => chains.includes(c.id as ChainId)).length
      if (currentMainnets <= 1) {
        toast.error("At least one mainnet chain must be enabled")
        return
      }
    }

    setChains(prev => {
      const next = prev.includes(chainId)
        ? prev.filter(c => c !== chainId)
        : [...prev, chainId]

      // Safety guard against rapid double-toggle: enforce limit against the actual next state,
      // not the closure value of `atLimit` which may be stale.
      if (!isEnabled && !isTestnet && chainLimit !== -1) {
        const nextMainnets = MAINNETS.filter(c => next.includes(c.id as ChainId)).length
        if (nextMainnets > chainLimit) return prev
      }

      clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
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
    const isTestnet = TESTNETS.has(chain.id)
    const locked = !enabled && !isTestnet && atLimit
    const usage = chainUsage[chain.id] ?? 0
    const logo = CHAIN_LOGOS[chain.id]

    return (
      <button
        type="button"
        onClick={() => toggle(chain.id as ChainId)}
        className={`flex items-center gap-3 w-full rounded-lg border px-4 py-3 text-left transition-colors ${locked ? "opacity-50 cursor-not-allowed" : "hover:bg-accent/40"}`}
        style={{ borderColor: enabled ? "rgba(99,102,241,0.5)" : undefined }}
      >
        {/* Chain logo */}
        <div className={`size-8 shrink-0 rounded-full overflow-hidden flex items-center justify-center ${logo ? "bg-transparent" : "bg-muted"}`}>
          {logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={logo} alt={chain.name} className="size-full object-contain" />
            : <span className="text-[10px] font-bold opacity-50">{chain.name.slice(0, 2).toUpperCase()}</span>
          }
        </div>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{chain.name}</p>
        </div>

        {/* Usage badge */}
        {usage > 0 && !locked && (
          <span className="text-xs text-muted-foreground tabular-nums shrink-0">
            {usage.toLocaleString()} {usage === 1 ? "interaction" : "interactions"}
          </span>
        )}

        {/* Lock icon or toggle */}
        {locked ? (
          <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <div
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ${enabled ? "bg-indigo-500" : "bg-muted-foreground/25"}`}
          >
            <span
              className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: enabled ? "translate(18px, 2px)" : "translate(2px, 2px)" }}
            />
          </div>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {/* Live counter — reads client state so it updates instantly on toggle */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Active mainnet chains</span>
        <span className="font-semibold tabular-nums">
          {activeMainnets} <span className="font-normal text-muted-foreground">of</span> {limitLabel}
        </span>
      </div>

      {/* Plan limit banner */}
      {atLimit && (
        <div className="flex items-start gap-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
          <Lock className="size-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-sm text-indigo-300">
            {plan === "free" || plan === "starter"
              ? <><Link href="/dashboard/account" className="underline underline-offset-2 hover:text-white">Upgrade to Pro</Link> to unlock up to 3 chains.</>
              : <>You&apos;ve reached the Pro limit of 3 chains. <a href="mailto:team@txid.support" className="underline underline-offset-2 hover:text-white">Contact us</a> for Enterprise access.</>
            }
          </p>
        </div>
      )}

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

      {/* Testnets */}
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
