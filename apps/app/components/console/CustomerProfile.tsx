import Link from "next/link"
import type { Customer } from "@/lib/console/fixtures"
import { ArrowLeft, ArrowRight } from "lucide-react"

const OUTCOME_CLS: Record<string, string> = {
  failed: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25",
  pending: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
  succeeded: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
}

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

/**
 * One customer, at their own URL: profile on top, full timeline under it,
 * successes INCLUDED. Half of support tickets are someone who did succeed and
 * cannot see it, or is looking at the wrong wallet; the timeline settles both
 * in one glance. Failure rows open as cases.
 */
export function CustomerProfile({ base, customer }: { base: string; customer: Customer }) {
  return (
    <div className="space-y-6">
      <div>
        <Link href={`${base}/customers`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Customers
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{customer.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{customer.email}</p>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground break-all">{customer.wallet}</p>
        <p className="mt-1 text-xs text-muted-foreground">Customer since {customer.since} · {customer.chain}</p>
      </div>

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
          Activity with your contracts
        </p>
        <ul className="space-y-1.5">
          {customer.interactions.map(i => {
            const isCase = Boolean(i.resolution)
            const row = (
              <span className="flex w-full items-center justify-between gap-4">
                <span className="min-w-0">
                  <span className="block text-sm text-foreground">{i.intent}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {when(i.at)} · {i.chain}
                    {i.resolution && <> · <span className="font-mono">{i.resolution.code}</span></>}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={`rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize ${OUTCOME_CLS[i.outcome]}`}>
                    {i.outcome}
                  </span>
                  {isCase && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                </span>
              </span>
            )
            return (
              <li key={i.id}>
                {isCase ? (
                  <Link href={`${base}/inbox/${i.id}`} className="flex rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40">
                    {row}
                  </Link>
                ) : (
                  <span className="flex rounded-lg border bg-card px-4 py-3 opacity-80">{row}</span>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
