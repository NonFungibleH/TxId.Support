import { currentUser } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { PLAN_LABELS } from "@/lib/types/config"
import type { Plan } from "@/lib/types/config"
import { cn } from "@/lib/utils"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map(e => e.trim()).filter(Boolean)

const PLAN_COLOR: Record<string, string> = {
  free:       "bg-muted text-muted-foreground",
  starter:    "bg-indigo-500/20 text-indigo-400",
  pro:        "bg-amber-500/20 text-amber-400",
  enterprise: "bg-purple-500/20 text-purple-400",
  custom:     "bg-emerald-500/20 text-emerald-400",
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

  // Platform-level aggregates
  const totalOrgs = new Set(stats.map(r => r.org_id)).size
  const totalProjects = stats.length
  const activeProjects = stats.filter(r => r.is_active).length
  const totalConvsMonth = stats.reduce((s, r) => s + Number(r.conv_count_month), 0)
  const totalConvsAll = stats.reduce((s, r) => s + Number(r.conv_count_total), 0)
  const totalMessages = stats.reduce((s, r) => s + Number(r.message_count), 0)
  const totalDocs = stats.reduce((s, r) => s + Number(r.doc_count), 0)

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
            { label: "Avg msgs / conv",   value: totalConvsAll > 0 ? (totalMessages / totalConvsAll).toFixed(1) : "—" },
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
          {(["free", "starter", "pro", "enterprise"] as Plan[]).map(p => (
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
                {["Organisation", "Project", "Plan", "Mode", "Status", "Convs (mo)", "Convs (total)", "Messages", "Docs", "Joined"].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {stats.map((row) => (
                <tr key={row.project_id} className="hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{row.org_name}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{row.project_name}</td>
                  <td className="px-4 py-3">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", PLAN_COLOR[row.plan] ?? PLAN_COLOR.free)}>
                      {PLAN_LABELS[row.plan as Plan] ?? row.plan}
                    </span>
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
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{monthsAgo(row.org_created_at)}</td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground text-sm">
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
        <h2 className="text-sm font-semibold mb-2">AI cost tracking</h2>
        <p className="text-sm text-muted-foreground">
          Token usage is not yet stored in the database. Add a <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">tokens_used</code> column
          to the <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">messages</code> table and populate it from the AI API response to
          enable cost tracking. Message count ({fmt(totalMessages)}) is the current proxy for AI usage.
        </p>
      </section>
    </div>
  )
}
