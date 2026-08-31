"use client"

import { useState } from "react"
import { Copy, Check, ExternalLink } from "lucide-react"
import type { Interaction } from "@/lib/console/fixtures"

const BASIS_NOTE: Record<string, string> = {
  verified: "Read live from the chain",
  derived: "Inferred from chain state, not directly stated",
  reported: "Told to us, not independently checked",
  indeterminate: "Could not be established",
}

const short = (s: string) => `${s.slice(0, 10)}…${s.slice(-6)}`

/**
 * One resolution, rendered the same wherever a case appears: the case page,
 * the customer timeline, the verify step. Extracted so those surfaces cannot
 * drift into describing the same failure three different ways.
 *
 * Leads with the triage question, who acts next, and states BASIS rather than
 * a confidence percentage: a number invites an argument it cannot win.
 */
export function ResolutionPanel({ interaction }: { interaction: Interaction }) {
  const [copied, setCopied] = useState(false)
  const r = interaction.resolution
  if (!r) return null

  async function copyReply(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* clipboard blocked; the text is on screen and selectable */ }
  }

  return (
    <div className="rounded-xl border border-primary/25 bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Resolution</span>
        <span className="rounded bg-primary/15 px-1.5 py-0.5 font-mono text-[11px] text-primary">{r.code}</span>
      </div>

      <div className="px-5 py-4">
        <p className="text-sm leading-relaxed text-foreground">{r.summary}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{r.detail}</p>

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

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <span className={`h-1.5 w-1.5 rounded-full ${r.basis === "verified" ? "bg-emerald-500" : "bg-amber-500"}`} />
          <span className="text-[11px] text-foreground capitalize">{r.basis}</span>
          <span className="text-[11px] text-muted-foreground">· {BASIS_NOTE[r.basis]}</span>
        </div>
      </div>

      <div className="border-t border-border px-5 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Reply to the customer</span>
          <button
            onClick={() => copyReply(r.reply)}
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
