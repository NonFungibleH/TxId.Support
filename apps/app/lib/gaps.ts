import { createServiceClient } from "@/lib/supabase/server"
import { rankTopics } from "@/lib/topics"

/**
 * Where TxID fell short, split by whose problem it is.
 *
 * THE DISTINCTION THAT MATTERS: a support lead needs to know whether an answer
 * was weak because the knowledge was missing (fix the docs) or because a chain
 * read failed (fix the infrastructure). Those look identical in a transcript
 * and have completely different owners. Failed lookups are recorded on the
 * message evidence, so the split is available here and nowhere else.
 */
export interface GapsReport {
  /**
   * Asked, and never answered. The strongest failure signal there is, and the
   * only one where the user gave up because nothing came back at all.
   */
  unanswered: GapItem[]
  /** Users who explicitly said the answer was wrong. */
  thumbsDown: GapItem[]
  /** Handed to a human, so the engine could not finish. */
  escalated: GapItem[]
  /** Negative sentiment that never escalated: the ones that leave quietly. */
  silentlyUnhappy: GapItem[]
  /** Reads that failed. Infrastructure, not knowledge. */
  dataGaps: { reason: string; count: number }[]
  /**
   * Answers with no live read and no documentation match behind them: the
   * assistant answered from its own knowledge. Not necessarily wrong, but the
   * only category nobody can check, which is what a compliance owner needs to
   * see. Computed from what happened, never self-reported.
   */
  ungrounded: GapItem[]
  /**
   * Questions the documentation did not cover. Distinct from every other
   * bucket: the user may have been perfectly happy with the answer, and the
   * team still needs to know the assistant had nothing to answer from.
   */
  docGaps: GapItem[]
  /**
   * How well the documentation is holding up, and what it costs to consult.
   * `avgContextChars` is prompt spend on every single message, so it belongs
   * next to the score that spend bought.
   */
  docCoverage: {
    answered: number
    noMatch: number
    weakMatch: number
    avgContextChars: number
  }
  /** Which subject areas the shortfalls cluster in. */
  byCategory: { category: string; count: number }[]
  /**
   * What users keep asking that went badly, ranked. The list of conversations
   * answers "what happened"; this answers "what do we write next", which is
   * the question a content owner actually has.
   */
  topics: { phrase: string; count: number; example: string }[]
  totals: { conversations: number; withProblems: number }
}

export interface GapItem {
  conversationId: string
  summary: string
  category: string | null
  createdAt: string
}

const NEGATIVE_SENTIMENT = new Set(["negative", "frustrated", "angry"])

/** Collapse a failure note to its recognisable prefix so like groups with like. */
function normaliseFailure(note: string): string {
  const cleaned = note.replace(/\s+/g, " ").trim()
  const colon = cleaned.indexOf(":")
  const head = colon > 0 && colon < 60 ? cleaned.slice(0, colon) : cleaned.slice(0, 60)
  return head.charAt(0).toUpperCase() + head.slice(1)
}


/**
 * Below this, the documentation technically matched but not well enough to
 * trust. A starting heuristic, not a measured constant: retrieval only returns
 * results above 0.35, so this marks the band just above the floor. Now that
 * scores are recorded, it can be tuned against real data rather than guessed.
 */
const WEAK_MATCH = 0.5

export async function buildGapsReport(projectId: string, days = 30): Promise<GapsReport> {
  const supabase = createServiceClient()
  const since = new Date()
  since.setDate(since.getDate() - days)

  const empty: GapsReport = {
    unanswered: [], thumbsDown: [], escalated: [], silentlyUnhappy: [], dataGaps: [],
    docGaps: [], ungrounded: [], docCoverage: { answered: 0, noMatch: 0, weakMatch: 0, avgContextChars: 0 },
    byCategory: [], topics: [],
    totals: { conversations: 0, withProblems: 0 },
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: conversations } = await (supabase as any)
    .from("conversations")
    .select("id, created_at, summary, category, sentiment")
    .eq("project_id", projectId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(2000)

  const convs = (conversations ?? []) as Array<{
    id: string; created_at: string; summary: string | null
    category: string | null; sentiment: string | null
  }>
  if (convs.length === 0) return empty
  const convIds = convs.map(c => c.id)
  const byId = new Map(convs.map(c => [c.id, c]))

  const [messagesRes, ticketsRes] = await Promise.all([
    // Evidence may not exist yet; fall back so the view still works.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("messages")
      .select("conversation_id, feedback, role, created_at, evidence, content")
      .in("conversation_id", convIds)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) =>
        res.error
          ? supabase.from("messages").select("conversation_id, feedback, role, created_at, content").in("conversation_id", convIds)
          : res,
      ),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("tickets").select("conversation_id").in("conversation_id", convIds),
  ])

  const toItem = (id: string): GapItem => {
    const c = byId.get(id)
    return {
      conversationId: id,
      summary: c?.summary ?? "No summary yet",
      category: c?.category ?? null,
      createdAt: c?.created_at ?? "",
    }
  }

    // Last message per conversation, to find the ones that never got a reply.
  const lastRole = new Map<string, { role: string; at: string }>()
  const thumbsDownIds = new Set<string>()
  const failureCounts = new Map<string, number>()
  const docGapIds = new Set<string>()
  const ungroundedIds = new Set<string>()
  const questionsByConv = new Map<string, string[]>()
  let answeredWithDocs = 0
  let noMatch = 0
  let weakMatch = 0
  let contextCharsTotal = 0
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of (messagesRes?.data ?? []) as any[]) {
    if (m.feedback === -1) thumbsDownIds.add(m.conversation_id)
    const seen = lastRole.get(m.conversation_id)
    if (!seen || (m.created_at && m.created_at > seen.at)) {
      lastRole.set(m.conversation_id, { role: m.role, at: m.created_at ?? "" })
    }
    // Documentation coverage, read from the same evidence blob. Only answers
    // that actually ran a search carry this, so token-mode and pre-evidence
    // rows are skipped rather than counted as misses.
    if (m.evidence?.grounding === "ungrounded") ungroundedIds.add(m.conversation_id)

    const retrieval = m.evidence?.retrieval
    if (retrieval && typeof retrieval.matched === "number") {
      answeredWithDocs++
      contextCharsTotal += typeof retrieval.contextChars === "number" ? retrieval.contextChars : 0
      if (retrieval.matched === 0) {
        noMatch++
        docGapIds.add(m.conversation_id)
      } else if (typeof retrieval.topScore === "number" && retrieval.topScore < WEAK_MATCH) {
        weakMatch++
        docGapIds.add(m.conversation_id)
      }
    }

    if (m.role === "user" && typeof m.content === "string" && m.content.trim().length > 3) {
      const list = questionsByConv.get(m.conversation_id) ?? []
      list.push(m.content.slice(0, 300))
      questionsByConv.set(m.conversation_id, list)
    }

    const failed = m.evidence?.investigation?.failedLookups
    if (Array.isArray(failed)) {
      for (const f of failed) {
        if (typeof f !== "string") continue
        const key = normaliseFailure(f)
        failureCounts.set(key, (failureCounts.get(key) ?? 0) + 1)
      }
    }
  }

  const escalatedIds = new Set<string>(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ((ticketsRes?.data ?? []) as any[]).map(t => t.conversation_id).filter(Boolean),
  )

  // Anything whose final message is the user's, and old enough that a reply is
  // not simply still streaming.
  const twoMinutesAgo = Date.now() - 2 * 60_000
  const unansweredIds = convs
    .filter(c => {
      const last = lastRole.get(c.id)
      if (!last || last.role !== "user") return false
      return !last.at || new Date(last.at).getTime() < twoMinutesAgo
    })
    .map(c => c.id)

  const silentIds = convs
    .filter(c => c.sentiment && NEGATIVE_SENTIMENT.has(c.sentiment.toLowerCase()))
    .filter(c => !escalatedIds.has(c.id) && !thumbsDownIds.has(c.id))
    .map(c => c.id)

  // Doc gaps are deliberately NOT counted as problems. A user can get a good
  // answer from live chain data while the docs covered nothing, and calling
  // that conversation a failure would overstate the number the team is judged
  // on. It is a content signal, not a service failure.
  const problemIds = new Set<string>([...unansweredIds, ...thumbsDownIds, ...escalatedIds, ...silentIds])

  const categoryCounts = new Map<string, number>()
  for (const id of problemIds) {
    const cat = byId.get(id)?.category ?? "uncategorised"
    categoryCounts.set(cat, (categoryCounts.get(cat) ?? 0) + 1)
  }

  return {
    unanswered: unansweredIds.slice(0, 10).map(toItem),
    thumbsDown: Array.from(thumbsDownIds).slice(0, 10).map(toItem),
    escalated: Array.from(escalatedIds).filter(id => byId.has(id)).slice(0, 10).map(toItem),
    silentlyUnhappy: silentIds.slice(0, 10).map(toItem),
    docGaps: Array.from(docGapIds).filter(id => byId.has(id)).slice(0, 10).map(toItem),
    ungrounded: Array.from(ungroundedIds).filter(id => byId.has(id)).slice(0, 10).map(toItem),
    docCoverage: {
      answered: answeredWithDocs,
      noMatch,
      weakMatch,
      avgContextChars: answeredWithDocs > 0 ? Math.round(contextCharsTotal / answeredWithDocs) : 0,
    },
    dataGaps: Array.from(failureCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([reason, count]) => ({ reason, count })),
    byCategory: Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count })),
    // Ranked from the questions in conversations that went badly OR that the
    // documentation could not cover. Both belong: a question answered from
    // chain data while the docs said nothing is still a page worth writing.
    topics: rankTopics(
      [...new Set([...problemIds, ...docGapIds])].flatMap(id => questionsByConv.get(id) ?? []),
    ),
    totals: { conversations: convs.length, withProblems: problemIds.size },
  }
}
