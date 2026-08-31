"use client"

import { useMemo, useState } from "react"
import { CUSTOMERS, findCustomer, type Customer, type Interaction } from "@/lib/console/fixtures"
import { Search, Copy, Check, ExternalLink } from "lucide-react"

/**
 * The Console workspace: one screen, search to sendable answer.
 *
 * Deliberately NOT a dashboard. An agent arrives with a customer waiting, so the
 * page opens on a search field and everything else is a consequence of what they
 * typed. Metrics live on their own page precisely so they cannot crowd this one.
 */

const OUTCOME = {
  succeeded: { label: "Succeeded", cls: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25" },
  failed: { label: "Failed", cls: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25" },
  pending: { label: "Pending", cls: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25" },
} as const

const BASIS_NOTE: Record<string, string> = {
  verified: "Read live from the chain",
  derived: "Inferred from chain state, not directly stated",
  reported: "Told to us, not independently checked",
  indeterminate: "Could not be established",
}

function when(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}
const short = (s: string) => `${s.slice(0, 10)}…${s.slice(-6)}`

export function ConsoleWorkspace() {
  const [query, setQuery] = useState("")
  const [submitted, setSubmitted] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const customer: Customer | null = useMemo(() => findCustomer(submitted), [submitted])
  const selected: Interaction | null = useMemo(() => {
    if (!customer) return null
    return customer.interactions.find(i => i.id === selectedId) ?? customer.interactions.find(i => i.resolution) ?? customer.interactions[0] ?? null
  }, [customer, selectedId])

  function run(q: string) {
    setSubmitted(q)
    setQuery(q)
    setSelectedId(null)
    setCopied(false)
  }

  async function copyReply(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked; the text is on screen and selectable */ }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight">Find a customer</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with whatever they gave you: an email, a wallet, or a transaction hash.
        </p>
      </div>

        <form
          onSubmit={e => { e.preventDefault(); run(query) }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search an email, wallet address, or transaction hash"
            aria-label="Find a customer"
            className="w-full rounded-xl border border-border bg-card py-3.5 pl-11 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
          />
        </form>

        {/* An agent has an email, never a hash. Make the realistic route obvious. */}
        {!customer && (
          <div className="mt-10">
            {submitted ? (
              <p className="text-sm text-muted-foreground">
                Nothing found for <span className="font-mono text-foreground">{submitted}</span>. Try an email address, a wallet, or a transaction hash.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Start with whatever the customer gave you.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {CUSTOMERS.map(c => (
                <button
                  key={c.id}
                  onClick={() => run(c.email)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-left text-xs hover:border-primary/40 transition-colors"
                >
                  <span className="block text-foreground">{c.email}</span>
                  <span className="block text-muted-foreground">{c.label} · {c.chain}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {customer && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
            {/* Everything this wallet has done with OUR contracts. Not their whole
                on-chain life: that is a privacy problem and a distraction. */}
            <section>
              <div className="mb-4">
                <h1 className="text-lg font-semibold">{customer.label}</h1>
                <p className="text-xs text-muted-foreground">{customer.email}</p>
                <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{customer.wallet}</p>
              </div>

              <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                Activity with your contracts
              </p>
              <ul className="space-y-1.5">
                {customer.interactions.map(i => {
                  const active = selected?.id === i.id
                  const o = OUTCOME[i.outcome]
                  return (
                    <li key={i.id}>
                      <button
                        onClick={() => { setSelectedId(i.id); setCopied(false) }}
                        aria-current={active}
                        className={[
                          "w-full rounded-lg border px-3.5 py-3 text-left transition-colors",
                          active ? "border-primary/50 bg-primary/10" : "border-border bg-card hover:border-border",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-foreground">{i.intent}</span>
                          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${o.cls}`}>{o.label}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>{when(i.at)}</span>
                          <span>·</span>
                          <span>{i.chain}</span>
                          {i.resolution && <><span>·</span><span className="font-mono">{i.resolution.code}</span></>}
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>

            <section className="lg:sticky lg:top-8 lg:self-start">
              {selected?.resolution ? (
                <Resolution interaction={selected} copied={copied} onCopy={copyReply} />
              ) : (
                <div className="rounded-xl border border-border bg-card p-6">
                  <p className="text-sm text-foreground">This one worked.</p>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selected ? `${selected.intent} completed on ${when(selected.at)}.` : "Pick an interaction."} A customer who cannot see a successful transaction is usually looking at a different wallet, which this page settles in one glance.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
    </div>
  )
}

function Resolution({
  interaction, copied, onCopy,
}: { interaction: Interaction; copied: boolean; onCopy: (t: string) => void }) {
  const r = interaction.resolution!
  return (
    <div className="rounded-xl border border-primary/25 bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Resolution</span>
        <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] text-primary">{r.code}</span>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-foreground">{r.summary}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.detail}</p>

        {/* The triage question an agent asks first is "is this us or them". */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-border pt-4">
          {[
            ["Funds", r.custody],
            ["Who acts next", r.nextActionOwner],
            ["Can retry", r.retryable],
            ["Category", r.category],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt>
              <dd className="text-xs text-foreground">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Basis, never a confidence percentage. A number invites an argument it
            cannot win; naming what we could actually check does not. */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <span className={`h-1.5 w-1.5 rounded-full ${r.basis === "verified" ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="text-[11px] text-foreground capitalize">{r.basis}</span>
          <span className="text-[11px] text-muted-foreground">· {BASIS_NOTE[r.basis]}</span>
        </div>
      </div>

      {/* The highest-value control on the page: the agent's job is replying. */}
      <div className="border-t border-border px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Reply to the customer</span>
          <button
            onClick={() => onCopy(r.reply)}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:border-primary/50 transition-colors"
          >
            {copied ? <><Check className="h-3 w-3 text-emerald-500" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
        </div>
        <p className="rounded-lg border border-border bg-muted px-3.5 py-3 text-xs leading-relaxed text-foreground">
          {r.reply}
        </p>
      </div>

      <details className="border-t border-border px-5 py-3">
        <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground">
          Evidence
        </summary>
        <dl className="mt-3 space-y-2">
          {r.evidence.map(e => (
            <div key={e.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[11px] text-muted-foreground">{e.label}</dt>
              <dd className="font-mono text-[11px] text-foreground text-right break-all">{e.value}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 pt-1">
            <dt className="text-[11px] text-muted-foreground">Transaction</dt>
            <dd className="font-mono text-[11px] text-foreground inline-flex items-center gap-1">
              {short(interaction.hash)} <ExternalLink className="h-3 w-3 text-muted-foreground" />
            </dd>
          </div>
        </dl>
      </details>
    </div>
  )
}
