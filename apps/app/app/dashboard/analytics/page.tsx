import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import dynamic from "next/dynamic"
import { MessageSquare, ThumbsUp, Zap, AlertCircle, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import type { Database } from "@/lib/supabase/types"

const ConversationChart = dynamic(
  () => import("@/components/dashboard/ConversationChart").then((m) => m.ConversationChart),
  { ssr: false }
)

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"]

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", day: "numeric" })
}

export default async function AnalyticsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()
  const projectId = typedProject.id

  // Date range: last 14 days
  const now = new Date()
  const since = new Date(now)
  since.setDate(since.getDate() - 13)
  since.setHours(0, 0, 0, 0)

  // Fetch conversations in range
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, created_at")
    .eq("project_id", projectId)
    .gte("created_at", since.toISOString())
    .order("created_at") as { data: Pick<ConversationRow, "id" | "created_at">[] | null }

  // Total conversations ever
  const { count: totalConversations } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)

  // Get all conversation IDs for message queries
  const { data: allConvIds } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", projectId) as { data: { id: string }[] | null }

  const convIdList = (allConvIds ?? []).map((c) => c.id)

  let totalMessages = 0
  let thumbsUp = 0
  let thumbsDown = 0

  if (convIdList.length > 0) {
    const { count: msgCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIdList)
    totalMessages = msgCount ?? 0

    const { count: upCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIdList)
      .eq("feedback", 1)
    thumbsUp = upCount ?? 0

    const { count: downCount } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .in("conversation_id", convIdList)
      .eq("feedback", -1)
    thumbsDown = downCount ?? 0
  }

  // Build chart data: one entry per day for the last 14 days
  const dayMap = new Map<string, number>()
  for (let i = 0; i < 14; i++) {
    const d = new Date(since)
    d.setDate(since.getDate() + i)
    dayMap.set(d.toDateString(), 0)
  }

  for (const conv of conversations ?? []) {
    const key = new Date(conv.created_at).toDateString()
    if (dayMap.has(key)) {
      dayMap.set(key, (dayMap.get(key) ?? 0) + 1)
    }
  }

  const chartData = Array.from(dayMap.entries()).map(([dateStr, conversations]) => ({
    date: formatDay(new Date(dateStr)),
    conversations,
  }))


  // P4: escalation metrics — requires tickets table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentTickets, count: openTicketCount } = await (supabase as any)
    .from("tickets")
    .select("ref, summary, status, created_at", { count: "exact" })
    .eq("project_id", projectId)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(5)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count: totalTickets } = await (supabase as any)
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)


  const hasData = (totalConversations ?? 0) > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Conversation insights and satisfaction ratings.</p>
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
            <p className="text-xs text-muted-foreground mt-0.5">{totalMessages} messages</p>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="size-3.5" />
              Satisfaction
              <span className="ml-auto text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full">Roadmap</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-0.5">Thumbs up / down coming soon</p>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5" />
              Escalation rate
              <span className="ml-auto text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded-full">Roadmap</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
            <p className="text-xs text-muted-foreground mt-0.5">Ticket escalation tracking coming soon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ThumbsUp className="size-3.5" />
              Open tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{openTicketCount ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              <Link href="/dashboard/tickets" className="hover:underline">View all →</Link>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Conversations — last 14 days</CardTitle>
        </CardHeader>
        <CardContent>
          <ConversationChart data={chartData} />
        </CardContent>
      </Card>

      {/* P4: Top open escalations — what the AI is failing on */}
      {(recentTickets ?? []).length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Open escalations</CardTitle>
            <Link href="/dashboard/tickets" className="text-xs text-muted-foreground hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {(recentTickets as Array<{ ref: string; summary: string; status: string; created_at: string }>).map((t) => (
                <li key={t.ref} className="flex items-start gap-3 px-6 py-3">
                  <Badge variant="outline" className="text-[10px] shrink-0 mt-0.5 font-mono">{t.ref}</Badge>
                  <p className="text-sm flex-1 leading-snug">{t.summary}</p>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(t.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
