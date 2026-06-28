import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ConversationList } from "@/components/dashboard/ConversationList"
import { ConversationFilters } from "@/components/dashboard/ConversationFilters"
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

interface SearchParams {
  wallet?: string
  chain?: string
  from?: string
  to?: string
}

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()

  const { wallet, chain, from, to } = searchParams
  const isFiltered = !!(wallet || chain || from || to)

  // Build query with optional filters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from("conversations")
    .select("id, session_id, wallet_address, chain_id, created_at")
    .eq("project_id", typedProject.id)
    .order("created_at", { ascending: false })
    .limit(isFiltered ? 200 : 50)

  if (wallet) q = q.ilike("wallet_address", `%${wallet}%`)
  if (chain) q = q.eq("chain_id", chain)
  if (from) q = q.gte("created_at", `${from}T00:00:00.000Z`)
  if (to) q = q.lte("created_at", `${to}T23:59:59.999Z`)

  const { data: conversations } = await q

  const filters = <ConversationFilters initial={{ wallet, chain, from, to }} />

  if (!conversations || conversations.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Conversations</h1>
          <p className="text-sm text-muted-foreground mt-1">Full transcripts of every user session.</p>
        </div>
        {filters}
        <div className="rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {isFiltered ? "No conversations match those filters." : "No conversations yet."}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isFiltered
              ? "Try broadening your search."
              : "They'll appear here once your widget is live."}
          </p>
        </div>
      </div>
    )
  }

  // Batch-fetch all messages for the returned conversations
  const convIds = conversations.map((c: { id: string }) => c.id)
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

  const data: ConversationWithMessages[] = conversations.map((c: ConversationWithMessages) => ({
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
          {isFiltered
            ? `${conversations.length} result${conversations.length !== 1 ? "s" : ""} — click any to expand the transcript.`
            : `${conversations.length} recent session${conversations.length !== 1 ? "s" : ""} — click any to expand the transcript.`}
        </p>
      </div>
      {filters}
      <ConversationList conversations={data} />
    </div>
  )
}
