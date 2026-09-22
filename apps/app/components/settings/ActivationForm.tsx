"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { saveActivation, type ActivationInput } from "@/lib/actions/activation"
import type { ActivationConfig, ActivationMode } from "@/lib/types/config"
import { ACTIVATION_DEFAULT, ACTIVATION_HOLDOUT_MAX } from "@/lib/types/config"
import { cn } from "@/lib/utils"

interface ContractLite { id: string; name: string; chainName: string }

const MODES: { value: ActivationMode; title: string; body: string }[] = [
  { value: "off", title: "Off", body: "Nothing changes for your users. The default." },
  {
    value: "prompt",
    title: "Small prompt",
    body: "A dismissible note beside the chat button when a new wallet connects. The checklist opens only if they click it.",
  },
  {
    value: "open_once",
    title: "Open once",
    body: "The panel opens on the checklist the first time a new wallet connects. Never on a phone, and never while they are typing on your page: then it falls back to the prompt.",
  },
]

const SPENDS: { value: ActivationInput["spendsKind"]; title: string; body: string }[] = [
  { value: "tokens", title: "Specific tokens", body: "A lending market or a vault: the checklist looks for these in the wallet, and for the approval." },
  { value: "native", title: "The chain's own coin", body: "Staking the native coin, or a lock paid in it. Gas and the asset become one check." },
  { value: "any", title: "Any token", body: "A swap, or a lock of whatever the user brings. The checklist covers network, gas and what the wallet will ask." },
]

function Choice({ selected, onSelect, title, body }: { selected: boolean; onSelect: () => void; title: string; body: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40",
      )}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        <span className={cn("size-3 rounded-full border", selected ? "border-primary bg-primary" : "border-muted-foreground/50")} aria-hidden />
        {title}
      </span>
      <span className="mt-1 block text-xs text-muted-foreground">{body}</span>
    </button>
  )
}

export function ActivationForm({
  initial,
  contracts,
}: {
  initial: ActivationConfig | null
  contracts: ContractLite[]
}) {
  const start = initial ?? ACTIVATION_DEFAULT
  const [mode, setMode] = useState<ActivationMode>(start.mode)
  const [action, setAction] = useState(initial ? start.action : "")
  const [contractId, setContractId] = useState<string>(start.contractId ?? contracts[0]?.id ?? "")
  const [spendsKind, setSpendsKind] = useState<ActivationInput["spendsKind"]>(start.spends.kind)
  const [tokens, setTokens] = useState<string[]>(
    start.spends.kind === "tokens" ? start.spends.tokens.map(t => t.address) : [""],
  )
  const [guideUrl, setGuideUrl] = useState(start.guideUrl ?? "")
  const [holdoutPct, setHoldoutPct] = useState(start.holdoutPct)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const symbols = start.spends.kind === "tokens" ? new Map(start.spends.tokens.map(t => [t.address.toLowerCase(), t.symbol])) : new Map<string, string>()

  const noContracts = contracts.length === 0

  const save = () => {
    setError(null)
    startTransition(async () => {
      const r = await saveActivation({
        mode,
        action,
        contractId: contractId || null,
        spendsKind,
        tokens,
        guideUrl,
        holdoutPct,
      })
      if (r.ok) toast.success(mode === "off" ? "Readiness check off" : "Readiness check saved")
      else setError(r.error)
    })
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-card p-5">
        <p className="font-semibold">How it is offered</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Only new wallets are offered the check: one that has already used your contracts never sees it.
        </p>
        <div role="radiogroup" aria-label="How the check is offered" className="mt-3 grid gap-2 sm:grid-cols-3">
          {MODES.map(m => (
            <Choice key={m.value} selected={mode === m.value} onSelect={() => setMode(m.value)} title={m.title} body={m.body} />
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div>
          <p className="font-semibold">The first action</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            What a new user comes to do. The checklist is built around it, and it is what counts as activated.
          </p>
        </div>

        {noContracts ? (
          <p className="text-sm text-muted-foreground">
            Add the contract your users send their first transaction to under Smart Contracts first. The readiness check covers EVM chains for now.
          </p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="act-word">In your users&apos; words</Label>
                <Input id="act-word" placeholder="deposit" value={action} maxLength={24} onChange={e => setAction(e.target.value)} />
                <p className="text-xs text-muted-foreground">Shown as &ldquo;ready for your first {action.trim() || "deposit"}&rdquo;.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="act-contract">Sent to</Label>
                <select
                  id="act-contract"
                  value={contractId}
                  onChange={e => setContractId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  {contracts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.chainName})</option>)}
                </select>
                <p className="text-xs text-muted-foreground">Its chain is where the checklist looks, and it is the contract a token is approved for.</p>
              </div>
            </div>

            <div>
              <Label>What it uses</Label>
              <div role="radiogroup" aria-label="What the first action uses" className="mt-1.5 grid gap-2 sm:grid-cols-3">
                {SPENDS.map(s => (
                  <Choice key={s.value} selected={spendsKind === s.value} onSelect={() => setSpendsKind(s.value)} title={s.title} body={s.body} />
                ))}
              </div>
            </div>

            {spendsKind === "tokens" && (
              <div className="space-y-2">
                <Label>Token addresses, on the contract&apos;s chain</Label>
                {tokens.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={t}
                      placeholder="0x…"
                      className="font-mono text-xs"
                      onChange={e => setTokens(tokens.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {symbols.get(t.trim().toLowerCase()) && (
                      <span className="shrink-0 text-xs font-medium text-muted-foreground">{symbols.get(t.trim().toLowerCase())}</span>
                    )}
                    {tokens.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setTokens(tokens.filter((_, j) => j !== i))}>Remove</Button>
                    )}
                  </div>
                ))}
                {tokens.length < 3 && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setTokens([...tokens, ""])}>Add a token</Button>
                )}
                <p className="text-xs text-muted-foreground">Each token&apos;s name is read from the chain when you save.</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="act-guide">Getting started guide (optional)</Label>
              <Input id="act-guide" placeholder="https://docs.yourprotocol.xyz/getting-started" value={guideUrl} onChange={e => setGuideUrl(e.target.value)} />
            </div>
          </>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-5">
        <p className="font-semibold">Comparison group</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          A share of new wallets never see the check, so you can see whether it makes a difference rather than take our word for it.
          Each wallet stays in its group on every device.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={ACTIVATION_HOLDOUT_MAX}
            value={holdoutPct}
            onChange={e => setHoldoutPct(Math.max(0, Math.min(ACTIVATION_HOLDOUT_MAX, Number(e.target.value) || 0)))}
            className="w-20"
            aria-label="Share of new wallets held out"
          />
          <span className="text-sm text-muted-foreground">% of new wallets see nothing</span>
        </div>
        {holdoutPct === 0 && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">With no comparison group there is nothing to compare against, so results show counts only.</p>
        )}
      </section>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || (noContracts && mode !== "off")}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
