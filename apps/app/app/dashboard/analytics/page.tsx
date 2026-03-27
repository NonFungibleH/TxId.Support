import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { createServiceClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import dynamic from "next/dynamic"
import { MessageSquare, ThumbsUp, ThumbsDown, Users } from "lucide-react"
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

  const satisfactionRate =
    thumbsUp + thumbsDown > 0
      ? Math.round((thumbsUp / (thumbsUp + thumbsDown)) * 100)
      : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-1">Conversation insights and satisfaction ratings.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <MessageSquare className="size-3.5" />
              Total conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalConversations ?? 0}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="size-3.5" />
              Total messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalMessages}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ThumbsUp className="size-3.5" />
              Helpful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{thumbsUp}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <ThumbsDown className="size-3.5" />
              Not helpful
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{thumbsDown}</p>
            {satisfactionRate !== null && (
              <p className="text-xs text-muted-foreground mt-0.5">{satisfactionRate}% satisfaction</p>
            )}
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
    </div>
  )
}
