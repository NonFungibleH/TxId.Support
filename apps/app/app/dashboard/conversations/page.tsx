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
  q?: string
  wallet?: string
  chain?: string
  from?: string
  to?: string
  limit?: string
}

function buildUrl(params: Record<string, string | undefined>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v) p.set(k, v)
  }
  const qs = p.toString()
  return `/dashboard/conversations${qs ? `?${qs}` : ""}`
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

  const { q, wallet, chain, from, to, limit: limitParam } = searchParams
  const limit = Math.min(parseInt(limitParam ?? "50", 10) || 50, 500)
  const isFiltered = !!(q || wallet || chain || from || to)

  // If content search is active, find matching conversation IDs first
  let contentMatchIds: string[] | null = null
  if (q) {
    const { data: allConvs } = await supabase
      .from("conversations")
      .select("id")
      .eq("project_id", typedProject.id)

    const allIds = (allConvs ?? []).map((c: { id: string }) => c.id)

    if (allIds.length > 0) {
      const { data: matchingMsgs } = await supabase
        .from("messages")
        .select("conversation_id")
        .ilike("content", `%${q}%`)
        .in("conversation_id", allIds)
      contentMatchIds = [...new Set((matchingMsgs ?? []).map((m: { conversation_id: string }) => m.conversation_id))]
    } else {
      contentMatchIds = []
    }
  }

  // Build main conversations query
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let convQuery: any = supabase
    .from("conversations")
    .select("id, session_id, wallet_address, chain_id, created_at", { count: "exact" })
    .eq("project_id", typedProject.id)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (wallet) convQuery = convQuery.ilike("wallet_address", `%${wallet}%`)
  if (chain) convQuery = convQuery.eq("chain_id", chain)
  if (from) convQuery = convQuery.gte("created_at", `${from}T00:00:00.000Z`)
  if (to) convQuery = convQuery.lte("created_at", `${to}T23:59:59.999Z`)
  if (contentMatchIds !== null) {
    const safeIds = contentMatchIds.length > 0 ? contentMatchIds : ["00000000-0000-0000-0000-000000000000"]
    convQuery = convQuery.in("id", safeIds)
  }

  const { data: conversations, count: totalCount } = await convQuery

  const filters = <ConversationFilters initial={{ q, wallet, chain, from, to }} />

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

  // Batch-fetch all messages + existing tickets for the returned conversations
  const convIds = conversations.map((c: { id: string }) => c.id)
  const [{ data: messages }, { data: tickets }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, conversation_id, role, content, feedback, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("tickets")
      .select("conversation_id, ref, status")
      .in("conversation_id", convIds),
  ])

  const msgByConv = new Map<string, typeof messages>()
  for (const msg of messages ?? []) {
    const existing = msgByConv.get(msg.conversation_id) ?? []
    existing.push(msg)
    msgByConv.set(msg.conversation_id, existing)
  }

  // Build data array, filtering out 0-message ghost sessions
  const data: ConversationWithMessages[] = conversations
    .map((c: ConversationWithMessages) => ({
      ...c,
      messages: (msgByConv.get(c.id) ?? []).map((m) => ({
        role: m.role,
        content: m.content,
        feedback: m.feedback,
        created_at: m.created_at,
      })),
    }))
    .filter((c: ConversationWithMessages) => c.messages.length > 0)

  // Build conv_id -> ticket ref map (most recent ticket per conversation)
  const ticketByConvId: Record<string, { ref: string; status: string }> = {}
  for (const t of (tickets ?? []) as { conversation_id: string; ref: string; status: string }[]) {
    if (t.conversation_id) ticketByConvId[t.conversation_id] = { ref: t.ref, status: t.status }
  }

  const shownCount = data.length
  const total = totalCount ?? conversations.length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Conversations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {isFiltered
            ? `${shownCount} result${shownCount !== 1 ? "s" : ""} — click any to expand the transcript.`
            : `${shownCount} session${shownCount !== 1 ? "s" : ""}${total > shownCount ? ` of ${total}` : ""} — click any to expand the transcript.`}
        </p>
      </div>
      {filters}
      <ConversationList conversations={data} existingTickets={ticketByConvId} />
      {total > conversations.length && (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-xs text-muted-foreground">Showing {conversations.length} of {total} sessions</p>
          <a
            href={buildUrl({ q, wallet, chain, from, to, limit: String(limit + 100) })}
            className="rounded-md border border-border px-4 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            Load more
          </a>
        </div>
      )}
    </div>
  )
}
