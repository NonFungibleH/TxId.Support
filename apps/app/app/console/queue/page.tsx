import type { Metadata } from "next"
import Link from "next/link"
import { CAUSES } from "@/lib/console/fixtures"
import { ArrowLeft, TrendingUp, TrendingDown, Minus, AlertTriangle } from "lucide-react"

export const metadata: Metadata = { title: "What is failing | TxID Console" }
export const dynamic = "force-dynamic"

const TREND = {
  up: { icon: TrendingUp, cls: "text-rose-600 dark:text-rose-400", label: "rising" },
  flat: { icon: Minus, cls: "text-muted-foreground", label: "steady" },
  down: { icon: TrendingDown, cls: "text-emerald-600 dark:text-emerald-400", label: "falling" },
} as const

/**
 * A list of CAUSES, each carrying the customers affected. Forty people hitting
 * one failure is one row with a count, not forty investigations.
 *
 * Ordered by whether funds are at stake, then by how many people. Not
 * first-in-first-out: a cosmetic failure affecting one person must never
 * outrank a stuck withdrawal.
 */
export default function QueuePage() {
  const ordered = [...CAUSES].sort(
    (a, b) => Number(b.fundsAtRisk) - Number(a.fundsAtRisk) || b.affected - a.affected,
  )
  const people = CAUSES.reduce((n, c) => n + c.affected, 0)

  return (
    <div>
      <div className="mb-6">
        <Link href="/console" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Find a customer
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">What is failing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {CAUSES.length} causes affecting {people} customers in the last 7 days. Grouped so one problem is one row.
        </p>
      </div>

      <ul className="space-y-2">
          {ordered.map(c => {
            const t = TREND[c.trend]
            const Icon = t.icon
            return (
              <li key={c.code}>
                <Link
                  href="/console"
                  className="block rounded-xl border border-border bg-card px-4 py-3.5 hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-foreground">{c.title}</span>
                        {c.fundsAtRisk && (
                          <span className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
                            <AlertTriangle className="h-2.5 w-2.5" /> Funds at stake
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-mono">{c.code}</span>
                        <span>·</span><span>{c.category}</span>
                        <span>·</span><span>acts next: {c.owner}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-lg font-semibold tabular-nums text-foreground">{c.affected}</p>
                      <p className={`inline-flex items-center gap-1 text-[11px] ${t.cls}`}>
                        <Icon className="h-3 w-3" /> {t.label}
                      </p>
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>

      <p className="mt-6 text-xs text-muted-foreground">
        Ordered by whether funds are at stake, then by how many people are affected. Age is deliberately not the primary sort.
      </p>
    </div>
  )
}
