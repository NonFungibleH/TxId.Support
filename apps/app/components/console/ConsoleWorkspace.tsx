"use client"

import { useMemo, useState } from "react"
import { CUSTOMERS, findCustomer, type Customer, type Interaction } from "@/lib/console/fixtures"
import { Search, Copy, Check, ChevronRight, ExternalLink } from "lucide-react"

/**
 * The Console workspace: one screen, search to sendable answer.
 *
 * Deliberately NOT a dashboard. An agent arrives with a customer waiting, so the
 * page opens on a search field and everything else is a consequence of what they
 * typed. Metrics live on their own page precisely so they cannot crowd this one.
 */

const OUTCOME = {
  succeeded: { label: "Succeeded", cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20" },
  failed: { label: "Failed", cls: "text-rose-300 bg-rose-500/10 border-rose-500/20" },
  pending: { label: "Pending", cls: "text-amber-300 bg-amber-500/10 border-amber-500/20" },
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
    <div className="min-h-screen bg-[#0b0d16] text-slate-100">
      <header className="border-b border-white/10 px-6 py-4">
        <div className="mx-auto max-w-6xl flex items-center gap-4">
          <span className="font-semibold tracking-tight">TxID Console</span>
          <span className="text-xs text-slate-500 font-mono">demo data</span>
          <a href="/console/queue" className="ml-auto text-sm text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1">
            What is failing <ChevronRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <form
          onSubmit={e => { e.preventDefault(); run(query) }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search an email, wallet address, or transaction hash"
            aria-label="Find a customer"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-3.5 pl-11 pr-4 text-sm outline-none placeholder:text-slate-500 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20"
          />
        </form>

        {/* An agent has an email, never a hash. Make the realistic route obvious. */}
        {!customer && (
          <div className="mt-10">
            {submitted ? (
              <p className="text-sm text-slate-400">
                Nothing found for <span className="font-mono text-slate-300">{submitted}</span>. Try an email address, a wallet, or a transaction hash.
              </p>
            ) : (
              <p className="text-sm text-slate-400">Start with whatever the customer gave you.</p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {CUSTOMERS.map(c => (
                <button
                  key={c.id}
                  onClick={() => run(c.email)}
                  className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs hover:border-indigo-400/40 transition-colors"
                >
                  <span className="block text-slate-200">{c.email}</span>
                  <span className="block text-slate-500">{c.label} · {c.chain}</span>
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
                <p className="text-xs text-slate-400">{customer.email}</p>
                <p className="mt-1 font-mono text-[11px] text-slate-500 break-all">{customer.wallet}</p>
              </div>

              <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">
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
                          active ? "border-indigo-400/50 bg-indigo-500/10" : "border-white/10 bg-white/[0.02] hover:border-white/20",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-100">{i.intent}</span>
                          <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${o.cls}`}>{o.label}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
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
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
                  <p className="text-sm text-slate-300">This one worked.</p>
                  <p className="mt-2 text-xs text-slate-500">
                    {selected ? `${selected.intent} completed on ${when(selected.at)}.` : "Pick an interaction."} A customer who cannot see a successful transaction is usually looking at a different wallet, which this page settles in one glance.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  )
}

function Resolution({
  interaction, copied, onCopy,
}: { interaction: Interaction; copied: boolean; onCopy: (t: string) => void }) {
  const r = interaction.resolution!
  return (
    <div className="rounded-xl border border-indigo-400/25 bg-white/[0.03]">
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <span className="text-[11px] uppercase tracking-wider text-slate-400">Resolution</span>
        <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[11px] text-indigo-300">{r.code}</span>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-slate-100">{r.summary}</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{r.detail}</p>

        {/* The triage question an agent asks first is "is this us or them". */}
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-white/10 pt-4">
          {[
            ["Funds", r.custody],
            ["Who acts next", r.nextActionOwner],
            ["Can retry", r.retryable],
            ["Category", r.category],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
              <dd className="text-xs text-slate-200">{v}</dd>
            </div>
          ))}
        </dl>

        {/* Basis, never a confidence percentage. A number invites an argument it
            cannot win; naming what we could actually check does not. */}
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
          <span className={`h-1.5 w-1.5 rounded-full ${r.basis === "verified" ? "bg-teal-400" : "bg-amber-400"}`} />
          <span className="text-[11px] text-slate-300 capitalize">{r.basis}</span>
          <span className="text-[11px] text-slate-500">· {BASIS_NOTE[r.basis]}</span>
        </div>
      </div>

      {/* The highest-value control on the page: the agent's job is replying. */}
      <div className="border-t border-white/10 px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-slate-400">Reply to the customer</span>
          <button
            onClick={() => onCopy(r.reply)}
            className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1 text-[11px] text-slate-200 hover:border-indigo-400/50 transition-colors"
          >
            {copied ? <><Check className="h-3 w-3 text-teal-400" /> Copied</> : <><Copy className="h-3 w-3" /> Copy</>}
          </button>
        </div>
        <p className="rounded-lg border border-white/10 bg-[#0f1220] px-3.5 py-3 text-xs leading-relaxed text-slate-200">
          {r.reply}
        </p>
      </div>

      <details className="border-t border-white/10 px-5 py-3">
        <summary className="cursor-pointer text-[11px] uppercase tracking-wider text-slate-400 hover:text-slate-200">
          Evidence
        </summary>
        <dl className="mt-3 space-y-2">
          {r.evidence.map(e => (
            <div key={e.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-[11px] text-slate-500">{e.label}</dt>
              <dd className="font-mono text-[11px] text-slate-300 text-right break-all">{e.value}</dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-3 pt-1">
            <dt className="text-[11px] text-slate-500">Transaction</dt>
            <dd className="font-mono text-[11px] text-slate-300 inline-flex items-center gap-1">
              {short(interaction.hash)} <ExternalLink className="h-3 w-3 text-slate-500" />
            </dd>
          </div>
        </dl>
      </details>
    </div>
  )
}
