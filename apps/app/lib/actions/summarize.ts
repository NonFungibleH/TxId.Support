"use server"

import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { completeChatWithUsage } from "@txid/ai"

// One-line AI summary + category + sentiment per conversation, so the
// Conversations page is scannable. Generated lazily and capped per call —
// no cron. Model cost is recorded to token_usage like every other AI turn.

export const CONV_CATEGORIES = ["failed-tx", "how-to", "bug-report", "feature-request", "account", "other"] as const
export type ConvCategory = (typeof CONV_CATEGORIES)[number]
const SENTIMENTS = ["positive", "neutral", "negative"] as const
type Sentiment = (typeof SENTIMENTS)[number]

export interface ConvSummary {
  id: string
  summary: string
  category: ConvCategory
  sentiment: Sentiment
}

const SYSTEM = `You label a single support conversation for a DeFi protocol's team dashboard. Reply ONLY with minified JSON: {"summary": string, "category": string, "sentiment": string}.
- summary: one plain-English sentence (max 140 chars) of what the user needed and whether it was resolved. No preamble.
- category: exactly one of failed-tx, how-to, bug-report, feature-request, account, other.
- sentiment: exactly one of positive, neutral, negative (the user's apparent mood by the end).
No markdown, no extra keys.`

function coerce(raw: string): { summary: string; category: ConvCategory; sentiment: Sentiment } {
  try {
    const start = raw.indexOf("{")
    const end = raw.lastIndexOf("}")
    const parsed = JSON.parse(raw.slice(start, end + 1)) as { summary?: unknown; category?: unknown; sentiment?: unknown }
    const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 160) : "Conversation"
    const category = CONV_CATEGORIES.includes(parsed.category as ConvCategory) ? (parsed.category as ConvCategory) : "other"
    const sentiment = SENTIMENTS.includes(parsed.sentiment as Sentiment) ? (parsed.sentiment as Sentiment) : "neutral"
    return { summary, category, sentiment }
  } catch {
    return { summary: "Conversation", category: "other", sentiment: "neutral" }
  }
}

/**
 * Summarise up to `limit` of the project's stale conversations (never
 * summarised, or messaged since the last summary). Returns the fresh summaries
 * for the client to merge. Safe to call on every Conversations page mount.
 */
export async function summarizeStaleConversations(limit = 8): Promise<ConvSummary[]> {
  const { project } = await getProject()
  if (!project) return []
  const projectId = (project as { id: string }).id
  const supabase = createServiceClient()

  // Stale = no summary yet, or a newer message than the last summary. The
  // column-vs-column predicate can't be expressed in PostgREST, so it lives in
  // the stale_conversations SQL function. If the migration isn't applied yet,
  // the RPC 404s and we simply return nothing (feature degrades to inert).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stale, error: staleErr } = await (supabase as any).rpc("stale_conversations", {
    p_project: projectId,
    p_limit: limit,
  })
  if (staleErr) return []

  const rows = (stale ?? []) as { id: string }[]
  if (rows.length === 0) return []

  const results = await Promise.all(
    rows.map(async (row): Promise<ConvSummary | null> => {
      const { data: msgs } = await supabase
        .from("messages")
        .select("role, content")
        .eq("conversation_id", row.id)
        .order("created_at", { ascending: true })
        .limit(40)
      const messages = (msgs ?? []) as { role: string; content: string }[]
      if (messages.length < 2) {
        // Nothing worth summarising yet — stamp it so we don't re-check every load.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("conversations").update({ summarized_at: new Date().toISOString() }).eq("id", row.id)
        return null
      }
      const transcript = messages
        .map(m => `${m.role === "user" ? "User" : "Assistant"}: ${m.content.slice(0, 600)}`)
        .join("\n")
      let out: { summary: string; category: ConvCategory; sentiment: Sentiment }
      let usage: { inputTokens: number; outputTokens: number; model: string } | null = null
      try {
        const res = await completeChatWithUsage(SYSTEM, [{ role: "user", content: transcript }], 200)
        out = coerce(res.text)
        usage = res.usage
      } catch {
        return null
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("conversations")
        .update({ summary: out.summary, category: out.category, sentiment: out.sentiment, summarized_at: new Date().toISOString() })
        .eq("id", row.id)
      if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any).from("token_usage").insert({
          project_id: projectId,
          conversation_id: row.id,
          model: usage.model,
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
        })
      }
      return { id: row.id, ...out }
    }),
  )

  return results.filter((r): r is ConvSummary => r !== null)
}

/** Force a re-summary of one conversation (dashboard "↻" button). */
export async function resummarizeConversation(conversationId: string): Promise<ConvSummary | null> {
  const { project } = await getProject()
  if (!project) return null
  const projectId = (project as { id: string }).id
  const supabase = createServiceClient()

  // Ownership check: the conversation must belong to this project.
  const { data: conv } = await supabase
    .from("conversations")
    .select("id, project_id")
    .eq("id", conversationId)
    .eq("project_id", projectId)
    .maybeSingle()
  if (!conv) return null

  // Clearing summarized_at makes it stale; reuse the batch path (limit 1 hits it first).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("conversations").update({ summarized_at: null }).eq("id", conversationId)
  const [only] = await summarizeStaleConversations(1)
  return only && only.id === conversationId ? only : null
}
