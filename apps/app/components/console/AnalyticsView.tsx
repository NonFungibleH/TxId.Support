import Link from "next/link"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CAUSES, CUSTOMERS } from "@/lib/console/fixtures"
import { TrendingUp, TrendingDown, Minus, Users, Ticket, ShieldCheck, Percent, AlertTriangle } from "lucide-react"

const TREND = {
  up: { icon: TrendingUp, cls: "text-rose-600 dark:text-rose-400", label: "rising" },
  flat: { icon: Minus, cls: "text-muted-foreground", label: "steady" },
  down: { icon: TrendingDown, cls: "text-emerald-600 dark:text-emerald-400", label: "falling" },
} as const

/**
 * Analytics absorbs the old "What is failing" page: the two showed the same
 * causes with different chrome, and the split meant neither could drill
 * through. Here every cause LINKS TO THE INBOX FILTERED TO IT, so "41 people
 * hit this" and the list of those 41 are the same data seen twice.
 */
export function AnalyticsView({ base }: { base: string }) {
  const affected = CAUSES.reduce((n, c) => n + c.affected, 0)
  const interactions = CUSTOMERS.flatMap(c => c.interactions).filter(i => i.resolution)
  const basis = interactions.reduce<Record<string, number>>((acc, i) => {
    acc[i.resolution!.basis] = (acc[i.resolution!.basis] ?? 0) + 1
    return acc
  }, {})
  const ours = CAUSES.filter(c => c.owner === "Protocol").reduce((n, c) => n + c.affected, 0)
  const max = Math.max(...CAUSES.map(c => c.affected))
  const ordered = [...CAUSES].sort(
    (a, b) => Number(b.fundsAtRisk) - Number(a.fundsAtRisk) || b.affected - a.affected,
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          What is failing, whether it is getting worse, and how much of it we could verify.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatsCard title="Customers affected" value={affected} description="Last 7 days" icon={Users} />
        <StatsCard title="Distinct causes" value={CAUSES.length} description="One row per problem" icon={Ticket} />
        <StatsCard title="Needing your action" value={ours} description="Rest sit with the user" icon={Percent} />
        <StatsCard title="Verified" value={basis.verified ?? 0} description="Read live from the chain" icon={ShieldCheck} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Causes, ordered by urgency</CardTitle>
          <p className="text-xs text-muted-foreground">Funds at stake first, then by people affected. Click one to see its cases.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {ordered.map(c => {
            const t = TREND[c.trend]
            const Icon = t.icon
            return (
              <Link key={c.code} href={`${base}/inbox?cause=${c.code}`} className="block group">
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-sm truncate group-hover:text-primary transition-colors">{c.title}</span>
                    {c.fundsAtRisk && (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" /> Funds
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Icon className={`size-3.5 ${t.cls}`} />
                    <span className="text-sm font-semibold tabular-nums">{c.affected}</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(c.affected / max) * 100}%` }} />
                </div>
              </Link>
            )
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What we could verify</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {Object.entries(basis).map(([k, v]) => (
              <div key={k}>
                <p className="text-2xl font-bold tabular-nums">{v}</p>
                <p className="text-xs text-muted-foreground capitalize">{k}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Taken as the worst basis on each case rather than an average. Averaging is how the one answer you could not verify stops being visible.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
