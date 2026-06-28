"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import { SUPPORTED_CHAINS } from "@/lib/types/config"

interface ConversationFiltersProps {
  initial: {
    wallet?: string
    chain?: string
    from?: string
    to?: string
  }
}

export function ConversationFilters({ initial }: ConversationFiltersProps) {
  const router = useRouter()
  const [wallet, setWallet] = useState(initial.wallet ?? "")
  const [chain, setChain] = useState(initial.chain ?? "")
  const [from, setFrom] = useState(initial.from ?? "")
  const [to, setTo] = useState(initial.to ?? "")

  const hasFilters = !!(wallet || chain || from || to)

  function apply() {
    const params = new URLSearchParams()
    if (wallet.trim()) params.set("wallet", wallet.trim())
    if (chain) params.set("chain", chain)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    const qs = params.toString()
    router.push(`/dashboard/conversations${qs ? `?${qs}` : ""}`)
  }

  function clear() {
    setWallet("")
    setChain("")
    setFrom("")
    setTo("")
    router.push("/dashboard/conversations")
  }

  const inputCls =
    "rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"

  return (
    <div className="flex flex-wrap gap-2 items-end">
      <input
        type="text"
        placeholder="Wallet address…"
        value={wallet}
        onChange={(e) => setWallet(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && apply()}
        className={`${inputCls} min-w-[200px] flex-1`}
      />

      <select
        value={chain}
        onChange={(e) => setChain(e.target.value)}
        className={`${inputCls} text-muted-foreground`}
      >
        <option value="">All chains</option>
        {SUPPORTED_CHAINS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div className="flex items-center gap-1.5">
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className={`${inputCls} text-muted-foreground`}
          title="From date"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className={`${inputCls} text-muted-foreground`}
          title="To date"
        />
      </div>

      <button
        onClick={apply}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        <Search className="size-3.5" />
        Search
      </button>

      {hasFilters && (
        <button
          onClick={clear}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
          Clear
        </button>
      )}
    </div>
  )
}
