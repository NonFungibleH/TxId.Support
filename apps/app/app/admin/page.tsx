import Link from "next/link"
import { currentUser, clerkClient } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { PLAN_LABELS } from "@/lib/types/config"
import type { Plan } from "@/lib/types/config"
import { cn } from "@/lib/utils"
import { PlanControl } from "@/components/admin/PlanControl"
import { PublicDemoToggle } from "@/components/admin/PublicDemoToggle"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map(e => e.trim()).filter(Boolean)

// Approximate Claude Haiku 4.5 pricing, in USD per million tokens. Adjust to
// match current Anthropic pricing — this drives the estimated-cost columns.
const USD_PER_MTOK_INPUT = 1.0
const USD_PER_MTOK_OUTPUT = 5.0

function estCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens / 1_000_000) * USD_PER_MTOK_INPUT + (outputTokens / 1_000_000) * USD_PER_MTOK_OUTPUT
}

function fmtUsd(n: number): string {
  return n < 0.01 && n > 0 ? "<$0.01" : `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

type TokenRow = { project_id: string; input_all: number; output_all: number; input_month: number; output_month: number }

const PLAN_COLOR: Record<string, string> = {
  free:       "bg-muted text-muted-foreground",
  starter:    "bg-indigo-500/20 text-indigo-400",
  pro:        "bg-amber-500/20 text-amber-400",
  enterprise: "bg-purple-500/20 text-purple-400",
  custom:     "bg-emerald-500/20 text-emerald-400",
  demo:       "bg-cyan-500/20 text-cyan-400",
}

function fmt(n: number | bigint) {
  return Number(n).toLocaleString()
}

function monthsAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
  if (diff === 0) return "today"
  if (diff < 7) return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return `${Math.floor(diff / 30)}mo ago`
}

type StatRow = {
  project_id: string
  org_id: string
  org_name: string
  clerk_org_id: string
  stripe_customer_id: string | null
  stripe_sub_status: string | null
  project_name: string
  is_active: boolean
  mode: string
  plan: string
  org_created_at: string
  project_created_at: string
  conv_count_total: number
  conv_count_month: number
  message_count: number
  doc_count: number
}

export default async function AdminPage() {
  // Auth guard — only allow configured admin emails
  const user = await currentUser()
  const primaryEmail = user?.emailAddresses?.find(e => e.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase()

  if (!primaryEmail || (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(primaryEmail))) {
    return notFound()
  }

  const supabase = createServiceClient()

  const { data: rows, error } = await supabase.rpc("admin_project_stats") as {
    data: StatRow[] | null
    error: { message: string } | null
  }

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-400 text-sm">RPC error: {error.message}</p>
        <p className="text-muted-foreground text-xs mt-1">Run the latest migration to create admin_project_stats().</p>
      </div>
    )
  }

  const stats = rows ?? []

  // Per-project token usage (all-time + this month) for the cost cockpit.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tokenRows } = await (supabase as any).rpc("admin_token_usage") as { data: TokenRow[] | null }
  const tokensByProject = new Map<string, TokenRow>()
  for (const t of tokenRows ?? []) {
    tokensByProject.set(t.project_id, {
      project_id: t.project_id,
      input_all: Number(t.input_all), output_all: Number(t.output_all),
      input_month: Number(t.input_month), output_month: Number(t.output_month),
    })
  }

  // Owner login per org, resolved from Clerk (the org:admin member, falling back
  // to the first member). Keyed by clerk_org_id, fetched once per unique org.
  // The sentinel "Demos" org has no real Clerk org, so its lookup fails and we
  // label it "internal" rather than surfacing an error.
  const uniqueClerkOrgIds = [...new Set(stats.map(r => r.clerk_org_id).filter(Boolean))]
  const ownerByClerkOrg = new Map<string, string>()
  const clerk = await clerkClient()
  await Promise.all(
    uniqueClerkOrgIds.map(async (orgId) => {
      if (!orgId.startsWith("org_")) {
        ownerByClerkOrg.set(orgId, "internal")
        return
      }
      try {
        const { data: members } = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId, limit: 100 })
        const owner = members.find(m => m.role === "org:admin") ?? members[0]
        const email = owner?.publicUserData?.identifier
        if (email) ownerByClerkOrg.set(orgId, email)
      } catch {
        // Org not found in Clerk (e.g. deleted or sentinel) — leave unset.
      }
    }),
  )

  // Per-project publicDemo flag (config JSONB) for the demo toggle column.
  const { data: configRows } = await supabase.from("projects").select("id, config")
  const publicDemoByProject = new Map<string, boolean>()
  for (const r of (configRows ?? []) as { id: string; config: { publicDemo?: boolean } | null }[]) {
    publicDemoByProject.set(r.id, r.config?.publicDemo === true)
  }

  // Platform-level aggregates
  const totalOrgs = new Set(stats.map(r => r.org_id)).size
  const totalProjects = stats.length
  const activeProjects = stats.filter(r => r.is_active).length
  const totalConvsMonth = stats.reduce((s, r) => s + Number(r.conv_count_month), 0)
  const totalConvsAll = stats.reduce((s, r) => s + Number(r.conv_count_total), 0)
  const totalMessages = stats.reduce((s, r) => s + Number(r.message_count), 0)
  const totalDocs = stats.reduce((s, r) => s + Number(r.doc_count), 0)

  const allTokenRows = [...tokensByProject.values()]
  const totalTokensMonth = allTokenRows.reduce((s, t) => s + t.input_month + t.output_month, 0)
  const totalCostMonth = allTokenRows.reduce((s, t) => s + estCostUsd(t.input_month, t.output_month), 0)
  const totalCostAll = allTokenRows.reduce((s, t) => s + estCostUsd(t.input_all, t.output_all), 0)

  const planCounts: Record<string, number> = {}
  for (const r of stats) {
    planCounts[r.plan] = (planCounts[r.plan] ?? 0) + 1
  }

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-10">
      {/* Header */}
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Internal — do not share</p>
        <h1 className="text-3xl font-bold">Admin Console</h1>
        <p className="text-muted-foreground mt-1">Logged in as {primaryEmail}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href="/admin/roadmap" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-indigo-500/40 hover:text-indigo-400 transition-colors">
            Product roadmap →
          </Link>
          <Link href="/admin/eval" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-border/80 transition-colors text-muted-foreground hover:text-foreground">
            Eval →
          </Link>
          <Link href="/admin/demos" className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium hover:border-emerald-500/40 hover:text-emerald-400 transition-colors">
            Demo creator →
          </Link>
        </div>
      </div>

      {/* Platform stats */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Platform overview</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Organisations",     value: fmt(totalOrgs) },
            { label: "Projects",          value: fmt(totalProjects) },
            { label: "Active projects",   value: fmt(activeProjects) },
            { label: "Convs this month",  value: fmt(totalConvsMonth) },
            { label: "Convs all time",    value: fmt(totalConvsAll) },
            { label: "Total messages",    value: fmt(totalMessages) },
            { label: "Knowledge docs",    value: fmt(totalDocs) },
            { label: "Tokens this month", value: fmtTokens(totalTokensMonth) },
            { label: "Est. cost (month)", value: fmtUsd(totalCostMonth) },
            { label: "Est. cost (all)",   value: fmtUsd(totalCostAll) },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Plan distribution */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Plan distribution</h2>
        <div className="flex flex-wrap gap-3">
          {(["free", "demo", "custom", "enterprise"] as Plan[]).map(p => (
            <div key={p} className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-3">
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PLAN_COLOR[p])}>
                {PLAN_LABELS[p]}
              </span>
              <span className="text-2xl font-bold tabular-nums">{planCounts[p] ?? 0}</span>
              <span className="text-xs text-muted-foreground">projects</span>
            </div>
          ))}
        </div>
      </section>

      {/* Per-project table */}
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
          All projects ({totalProjects})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Organisation", "Owner", "Project", "Plan", "Public demo", "Mode", "Status", "Convs (mo)", "Convs (total)", "Messages", "Docs", "Tokens (mo)", "Est. $ (mo)", "Joined"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.map((row) => (
                <tr key={row.project_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{row.org_name}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {(() => {
                      const owner = ownerByClerkOrg.get(row.clerk_org_id)
                      if (!owner) return <span className="text-muted-foreground/50">—</span>
                      if (owner === "internal") return <span className="text-xs text-muted-foreground italic">internal</span>
                      return <span className="text-xs text-muted-foreground font-mono">{owner}</span>
                    })()}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.project_name}</td>
                  <td className="px-4 py-3">
                    <PlanControl projectId={row.project_id} currentPlan={(row.plan as Plan) ?? "free"} />
                  </td>
                  <td className="px-4 py-3">
                    <PublicDemoToggle projectId={row.project_id} initial={publicDemoByProject.get(row.project_id) ?? false} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{row.mode ?? "support"}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[11px] font-medium", row.is_active ? "text-green-400" : "text-muted-foreground")}>
                      {row.is_active ? "Live" : "Draft"}
                    </span>
                  </td>
                  <td className="px-4 py-3 tabular-nums font-medium">
                    {fmt(row.conv_count_month)}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmt(row.conv_count_total)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmt(row.message_count)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{fmt(row.doc_count)}</td>
                  {(() => {
                    const t = tokensByProject.get(row.project_id)
                    const monthTokens = t ? t.input_month + t.output_month : 0
                    const monthCost = t ? estCostUsd(t.input_month, t.output_month) : 0
                    return (
                      <>
                        <td className="px-4 py-3 tabular-nums text-muted-foreground">{monthTokens > 0 ? fmtTokens(monthTokens) : "—"}</td>
                        <td className="px-4 py-3 tabular-nums font-medium">{monthCost > 0 ? fmtUsd(monthCost) : "—"}</td>
                      </>
                    )
                  })()}
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{monthsAgo(row.org_created_at)}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    No projects found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cost note */}
      <section className="rounded-xl border border-dashed border-border p-5">
        <h2 className="text-sm font-semibold mb-2">About these cost estimates</h2>
        <p className="text-sm text-muted-foreground">
          Token counts are live from the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">token_usage</code> table
          (one row per AI turn, widget and Telegram). Costs apply Claude Haiku 4.5 pricing
          (${USD_PER_MTOK_INPUT.toFixed(2)}/M input, ${USD_PER_MTOK_OUTPUT.toFixed(2)}/M output) to <em>all</em> turns; Groq-fallback
          turns are cheaper or free, so the figures are an upper bound. Turns before token tracking
          was deployed aren&apos;t counted. If every project reads $0, the{" "}
          <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">20260706000003_token_usage</code> migration
          likely hasn&apos;t been applied to this database yet.
        </p>
      </section>
    </div>
  )
}
