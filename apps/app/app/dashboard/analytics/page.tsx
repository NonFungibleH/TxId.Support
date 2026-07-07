import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import dynamic from "next/dynamic"
import { MessageSquare, AlertCircle, Zap } from "lucide-react"
import Link from "next/link"
import type { Database } from "@/lib/supabase/types"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_CONV_LIMITS } from "@/lib/types/config"
import { cn } from "@/lib/utils"
import { AnalyticsPeriodSelector } from "@/components/dashboard/AnalyticsPeriodSelector"

const ConversationChart = dynamic(
  () => import("@/components/dashboard/ConversationChart").then((m) => m.ConversationChart),
  { ssr: false },
)

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"]

// Normalize hex or decimal chain ID to a canonical decimal string
function normalizeChainId(id: string): string {
  if (id.startsWith("0x") || id.startsWith("0X")) {
    return String(parseInt(id, 16))
  }
  return id
}

const CHAIN_NAMES: Record<string, string> = {
  "1": "Ethereum",
  "8453": "Base",
  "42161": "Arbitrum",
  "137": "Polygon",
  "10": "Optimism",
  "56": "BNB Chain",
  "43114": "Avalanche",
  "250": "Fantom",
  "11155111": "Sepolia",
}

const CHAIN_LOGOS: Record<string, string> = {
  "1": "/chains/Ethereum.png",
  "8453": "/chains/Base.png",
  "42161": "/chains/Arbitrum.png",
  "137": "/chains/Polygon.png",
  "10": "/chains/Optimism.png",
  "56": "/chains/BNB.png",
}

function formatDay(date: Date, totalDays: number): string {
  if (totalDays <= 14) {
    return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
  }
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

interface SearchParams { days?: string }

export default async function AnalyticsPage({ searchParams }: { searchParams: SearchParams }) {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()
  const projectId = typedProject.id

  const config = typedProject.config as unknown as ProjectConfig
  const plan = (config.plan ?? "free") as Plan
  const convLimit = PLAN_CONV_LIMITS[plan]
  const convLimitLabel = convLimit === Infinity ? null : convLimit.toLocaleString()

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const { count: monthlyCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .gte("created_at", monthStart.toISOString())

  const monthlyUsed = monthlyCount ?? 0
  const usagePct = convLimit === Infinity ? 0 : Math.round((monthlyUsed / convLimit) * 100)

  const days = Math.min(parseInt(searchParams.days ?? "14", 10) || 14, 90)

  const since = new Date(now)
  since.setDate(since.getDate() - (days - 1))
  since.setHours(0, 0, 0, 0)

  // Conversations in selected period
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, created_at, chain_id")
    .eq("project_id", projectId)
    .gte("created_at", since.toISOString())
    .order("created_at") as { data: Pick<ConversationRow, "id" | "created_at" | "chain_id">[] | null }

  // Total conversations ever
  const { count: totalConversations } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)

  // Total messages via SQL join — avoids O(n) IN clause
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: msgCountData } = await (supabase as any)
    .rpc("get_project_message_count", { p_project_id: projectId })
  const totalMessages = (msgCountData as number | null) ?? 0

  // Escalation rate: % of conversations in the period that opened a support ticket
  let escalationRate: number | null = null
  const periodConvCount = (conversations ?? []).length
  if (periodConvCount > 0) {
    // Count tickets for this project in the period directly — robust to whether
    // the escalation RPC has been applied to the database.
    const { count: escalCount } = await supabase
      .from("tickets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .gte("created_at", since.toISOString())
    const escalated = escalCount ?? 0
    escalationRate = Math.min(100, Math.round((escalated / periodConvCount) * 100))
  }

  // Chain breakdown (all-time) — normalize hex IDs before counting to avoid duplicates
  const chainCounts = new Map<string, number>()
  for (const conv of (await supabase
    .from("conversations")
    .select("chain_id")
    .eq("project_id", projectId)
    .not("chain_id", "is", null)).data ?? []) {
    const raw = (conv as { chain_id: string | null }).chain_id
    if (!raw) continue
    const id = normalizeChainId(raw)
    chainCounts.set(id, (chainCounts.get(id) ?? 0) + 1)
  }
  const totalChainConvs = Array.from(chainCounts.values()).reduce((a, b) => a + b, 0)
  const chainBreakdown = Array.from(chainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([chainId, count]) => ({
      chainId,
      name: CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
      count,
      pct: totalChainConvs > 0 ? Math.round((count / totalChainConvs) * 100) : 0,
    }))

  // Build chart data
  const dayMap = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    dayMap.set(d.toDateString(), 0)
  }
  for (const conv of conversations ?? []) {
    const key = new Date(conv.created_at).toDateString()
    if (dayMap.has(key)) dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
  }
  const chartData = Array.from(dayMap.entries()).map(([dateStr, count]) => ({
    date: formatDay(new Date(dateStr), days),
    conversations: count,
  }))

  const periodConversations = (conversations ?? []).length
  const avgMessages = periodConversations > 0
    ? (totalMessages / (totalConversations ?? 1)).toFixed(1)
    : "—"
  const hasData = (totalConversations ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-1">Conversation insights for your support widget.</p>
        </div>
        <AnalyticsPeriodSelector current={days} />
      </div>

      {convLimitLabel && usagePct >= 80 && (
        <div className={cn(
          "rounded-xl border p-4 flex items-start gap-3",
          usagePct >= 100
            ? "border-red-500/40 bg-red-500/10"
            : "border-amber-500/40 bg-amber-500/10",
        )}>
          <AlertCircle className={cn("size-4 mt-0.5 shrink-0", usagePct >= 100 ? "text-red-400" : "text-amber-400")} />
          <p className={cn("text-sm", usagePct >= 100 ? "text-red-300" : "text-amber-300")}>
            {usagePct >= 100
              ? <>You&apos;ve reached your monthly limit of {convLimitLabel} conversations. New chats are paused. </>
              : <>{usagePct}% of your monthly {convLimitLabel}-conversation limit used. </>}
            <a
              href="mailto:team@txid.support?subject=Upgrade enquiry"
              className="underline underline-offset-2 hover:opacity-80"
            >
              Upgrade to increase your limit
            </a>
          </p>
        </div>
      )}

      {!hasData && (
        <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-6 flex items-start gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Zap className="size-4 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-sm">No conversations yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Analytics will appear here once your widget is embedded and users start chatting.{" "}
              <Link href="/dashboard/embed" className="text-primary underline underline-offset-2">
                Get your embed code →
              </Link>
            </p>
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              Total conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalConversations ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{totalMessages} messages total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              This period
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{periodConversations}</p>
            <p className="text-xs text-muted-foreground mt-0.5">last {days} days · avg {avgMessages} msgs each</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              Escalated
            </CardTitle>
          </CardHeader>
          <CardContent>
            {escalationRate !== null ? (
              <>
                <p className="text-2xl font-bold">{escalationRate}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">Conversations that raised a ticket</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-muted-foreground">—</p>
                <p className="text-xs text-muted-foreground mt-0.5">No data in this period</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              Satisfaction
              <span className="ml-auto text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full">Roadmap</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-0.5">Thumbs up / down coming soon</p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Conversations: last {days} days</CardTitle>
        </CardHeader>
        <CardContent>
          <ConversationChart data={chartData} />
        </CardContent>
      </Card>

      {/* Chain breakdown */}
      {chainBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Conversations by network (all time)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {chainBreakdown.map(({ chainId, name, count, pct }) => {
                const logo = CHAIN_LOGOS[chainId]
                return (
                  <div
                    key={chainId}
                    className="flex items-center gap-2.5 rounded-xl border border-border bg-muted/40 px-4 py-3 min-w-[140px]"
                  >
                    {logo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logo} alt={name} className="size-5 rounded-full object-contain shrink-0" />
                    ) : (
                      <div className="size-5 rounded-full bg-muted shrink-0" />
                    )}
                    <div>
                      <p className="text-xs font-medium leading-none">{name}</p>
                      <p className="text-lg font-bold tabular-nums leading-tight mt-0.5">
                        {count}
                        <span className="text-xs font-normal text-muted-foreground ml-1">{pct}%</span>
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
