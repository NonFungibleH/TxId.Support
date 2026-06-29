import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import dynamic from "next/dynamic"
import { MessageSquare, CheckCircle2, AlertCircle, Zap } from "lucide-react"
import Link from "next/link"
import type { Database } from "@/lib/supabase/types"
import { AnalyticsPeriodSelector } from "@/components/dashboard/AnalyticsPeriodSelector"

const ConversationChart = dynamic(
  () => import("@/components/dashboard/ConversationChart").then((m) => m.ConversationChart),
  { ssr: false },
)

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"]

const CHAIN_NAMES: Record<string, string> = {
  "1": "Ethereum", "8453": "Base", "42161": "Arbitrum",
  "137": "Polygon", "10": "Optimism", "56": "BNB Chain",
  "43114": "Avalanche", "250": "Fantom",
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

  const days = Math.min(parseInt(searchParams.days ?? "14", 10) || 14, 90)

  const now = new Date()
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

  // All conversation IDs for message queries
  const { data: allConvIds } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", projectId) as { data: { id: string }[] | null }

  const convIdList = (allConvIds ?? []).map((c) => c.id)

  // Total messages ever
  let totalMessages = 0
  if (convIdList.length > 0) {
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIdList)
    totalMessages = count ?? 0
  }

  // Resolved rate: last message role per conversation in the selected period
  let resolvedRate: number | null = null
  const periodConvIds = (conversations ?? []).map(c => c.id)
  if (periodConvIds.length > 0) {
    const { data: periodMsgs } = await supabase
      .from("messages")
      .select("conversation_id, role, created_at")
      .in("conversation_id", periodConvIds)
      .order("created_at", { ascending: false })

    const seenConvs = new Set<string>()
    let resolvedCount = 0
    for (const msg of periodMsgs ?? []) {
      if (seenConvs.has(msg.conversation_id)) continue
      seenConvs.add(msg.conversation_id)
      if (msg.role === "assistant") resolvedCount++
    }
    if (seenConvs.size > 0) {
      resolvedRate = Math.round((resolvedCount / seenConvs.size) * 100)
    }
  }

  // Chain breakdown (all-time)
  const chainCounts = new Map<string, number>()
  for (const conv of allConvIds ? (await supabase
    .from("conversations")
    .select("chain_id")
    .eq("project_id", projectId)
    .not("chain_id", "is", null)).data ?? [] : []) {
    const id = (conv as { chain_id: string | null }).chain_id
    if (id) chainCounts.set(id, (chainCounts.get(id) ?? 0) + 1)
  }
  const chainBreakdown = Array.from(chainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([chainId, count]) => ({ chainId, name: CHAIN_NAMES[chainId] ?? chainId, count }))
  const maxChainCount = chainBreakdown[0]?.count ?? 1

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
              <CheckCircle2 className="size-3.5" />
              Resolved rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            {resolvedRate !== null ? (
              <>
                <p className="text-2xl font-bold">{resolvedRate}%</p>
                <p className="text-xs text-muted-foreground mt-0.5">AI had the last word this period</p>
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
          <CardTitle className="text-sm font-medium">Conversations — last {days} days</CardTitle>
        </CardHeader>
        <CardContent>
          <ConversationChart data={chartData} />
        </CardContent>
      </Card>

      {/* Chain breakdown */}
      {chainBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Users by network (all time)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {chainBreakdown.map(({ chainId, name, count }) => (
              <div key={chainId} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-24 shrink-0">{name}</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${Math.round((count / maxChainCount) * 100)}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted-foreground w-6 text-right">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
