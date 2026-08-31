import type { Metadata } from "next"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CAUSES, CUSTOMERS } from "@/lib/console/fixtures"
import { TrendingUp, TrendingDown, Minus, Users, Ticket, ShieldCheck, Percent } from "lucide-react"

export const metadata: Metadata = { title: "Analytics | TxID Console" }
export const dynamic = "force-dynamic"

const TREND = {
  up: { icon: TrendingUp, cls: "text-rose-600 dark:text-rose-400" },
  flat: { icon: Minus, cls: "text-muted-foreground" },
  down: { icon: TrendingDown, cls: "text-emerald-600 dark:text-emerald-400" },
} as const

/**
 * Analytics for a support lead, mirroring the support product's page: what is
 * failing, whether it is getting worse, and how much of it we could actually
 * verify.
 *
 * NO PERCENTAGES ON SMALL SAMPLES beyond the basis mix, and the basis mix is a
 * worst-case per case rather than an average, for the same reason the support
 * analytics does it that way: averaging is how the one unverifiable answer
 * disappears.
 */
export default function ConsoleAnalyticsPage() {
  const affected = CAUSES.reduce((n, c) => n + c.affected, 0)
  const interactions = CUSTOMERS.flatMap(c => c.interactions).filter(i => i.resolution)
  const basis = interactions.reduce<Record<string, number>>((acc, i) => {
    const b = i.resolution!.basis
    acc[b] = (acc[b] ?? 0) + 1
    return acc
  }, {})
  const owners = CAUSES.reduce<Record<string, number>>((acc, c) => {
    acc[c.owner] = (acc[c.owner] ?? 0) + c.affected
    return acc
  }, {})
  const ours = owners["Protocol"] ?? 0
  const max = Math.max(...CAUSES.map(c => c.affected))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
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
          <CardTitle className="text-base">Causes by volume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...CAUSES].sort((a, b) => b.affected - a.affected).map(c => {
            const t = TREND[c.trend]
            const Icon = t.icon
            return (
              <div key={c.code}>
                <div className="flex items-baseline justify-between gap-3 mb-1">
                  <span className="text-sm truncate">{c.title}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <Icon className={`size-3.5 ${t.cls}`} />
                    <span className="text-sm font-semibold tabular-nums">{c.affected}</span>
                  </span>
                </div>
                {/* A bar, not a chart library: one dimension, four rows. */}
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(c.affected / max) * 100}%` }} />
                </div>
              </div>
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
