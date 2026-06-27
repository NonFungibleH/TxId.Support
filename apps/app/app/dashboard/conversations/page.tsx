import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ConversationList } from "@/components/dashboard/ConversationList"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export interface ConversationWithMessages {
  id: string
  session_id: string
  wallet_address: string | null
  chain_id: string | null
  created_at: string
  messages: Array<{ role: string; content: string; feedback: number; created_at: string }>
}

export default async function ConversationsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()

  // Fetch last 50 conversations with their messages
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, session_id, wallet_address, chain_id, created_at")
    .eq("project_id", typedProject.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (!conversations || conversations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground mt-1">Full transcripts of every user session.</p>
        </div>
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
          <p className="text-xs text-muted-foreground mt-1">They&apos;ll appear here once your widget is live.</p>
        </div>
      </div>
    )
  }

  // Batch-fetch all messages for the returned conversations
  const convIds = conversations.map((c) => c.id)
  const { data: messages } = await supabase
    .from("messages")
    .select("id, conversation_id, role, content, feedback, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: true })

  // Group messages by conversation ID
  const msgByConv = new Map<string, typeof messages>()
  for (const msg of messages ?? []) {
    const existing = msgByConv.get(msg.conversation_id) ?? []
    existing.push(msg)
    msgByConv.set(msg.conversation_id, existing)
  }

  const data: ConversationWithMessages[] = conversations.map((c) => ({
    ...c,
    messages: (msgByConv.get(c.id) ?? []).map((m) => ({
      role: m.role,
      content: m.content,
      feedback: m.feedback,
      created_at: m.created_at,
    })),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {conversations.length} recent session{conversations.length !== 1 ? "s" : ""} — click any to expand the transcript.
        </p>
      </div>
      <ConversationList conversations={data} />
    </div>
  )
}
