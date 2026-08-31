import Link from "next/link"
import { ResolutionPanel } from "./ResolutionPanel"
import type { Customer, Interaction } from "@/lib/console/fixtures"
import { ArrowLeft } from "lucide-react"

/**
 * One case, at its own URL: the screen an agent lives in, and the link they
 * paste to a teammate. The customer sits beside the resolution because "who is
 * this and what else have they done" is the next question after "what happened".
 */
export function CaseDetail({
  base, customer, interaction,
}: { base: string; customer: Customer; interaction: Interaction }) {
  return (
    <div className="space-y-6">
      <div>
        <Link href={`${base}/inbox`} className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Inbox
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{interaction.intent}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {new Date(interaction.at).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {interaction.chain}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ResolutionPanel interaction={interaction} />

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="rounded-xl border bg-card p-4">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Customer</p>
            <Link href={`${base}/customers/${customer.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors">
              {customer.label}
            </Link>
            <p className="text-xs text-muted-foreground">{customer.email}</p>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground break-all">{customer.wallet}</p>
            <p className="mt-2 text-xs text-muted-foreground">Customer since {customer.since} · {customer.chain}</p>
            <Link href={`${base}/customers/${customer.id}`} className="mt-3 inline-block text-xs text-primary hover:underline">
              Full history
            </Link>
          </div>
        </aside>
      </div>
    </div>
  )
}
