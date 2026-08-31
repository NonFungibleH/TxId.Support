import Link from "next/link"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { overview } from "@/lib/console/overview"
import { setupState, DEMO_SETUP } from "@/lib/console/setup"
import { SetupChecklist } from "@/components/console/SetupChecklist"
import { Users, Ticket, AlertTriangle, ShieldCheck, ArrowRight, Search } from "lucide-react"


const OUTCOME_CLS: Record<string, string> = {
  failed: "text-rose-600 dark:text-rose-400",
  pending: "text-amber-600 dark:text-amber-400",
  succeeded: "text-emerald-600 dark:text-emerald-400",
}

/**
 * Console Overview, laid out like the support product's: a stats row, then the
 * things that need a person, then a way in.
 *
 * Ordered by what a support lead opens this page to learn, which is what is
 * broken and who is waiting, not how much volume we processed.
 */
export function ConsoleOverview({ base = "/console" }: { base?: string }) {
  const o = overview()
  const setup = setupState(DEMO_SETUP, base)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Console</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Failed transactions across your contracts, and the customers waiting on them.
        </p>
      </div>

      {!setup.complete && <SetupChecklist state={setup} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatsCard title="Customers affected" value={o.affected} description="Last 7 days" icon={Users} />
        <StatsCard title="Distinct causes" value={o.causes} description="Grouped, not per ticket" icon={Ticket} />
        <StatsCard title="Funds at stake" value={o.fundsAtRiskCauses} description="Causes needing priority" icon={AlertTriangle} />
        <StatsCard title="Verified answers" value={`${o.verifiedShare}%`} description="Read live from the chain" icon={ShieldCheck} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What needs attention</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {o.topCauses.map(c => (
              <Link
                key={c.code}
                href={`${base}/queue`}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm">{c.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="font-mono">{c.code}</span> · acts next: {c.owner}
                    {c.fundsAtRisk && <span className="text-amber-600 dark:text-amber-400"> · funds at stake</span>}
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{c.affected}</span>
              </Link>
            ))}
            <Link href={`${base}/queue`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline pt-1">
              See everything failing <ArrowRight className="size-3.5" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recently diagnosed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {o.recent.map(r => (
              <Link
                key={r.id}
                href={`${base}/cases`}
                className="flex items-center justify-between gap-3 rounded-lg border p-3 hover:border-primary/40 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-sm truncate">{r.intent}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {r.who} · <span className="font-mono">{r.code}</span>
                  </p>
                </div>
                <span className={`text-xs capitalize shrink-0 ${OUTCOME_CLS[r.outcome]}`}>{r.outcome}</span>
              </Link>
            ))}
            <Link href={`${base}/cases`} className="inline-flex items-center gap-1 text-sm text-primary hover:underline pt-1">
              <Search className="size-3.5" /> Find a customer
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
