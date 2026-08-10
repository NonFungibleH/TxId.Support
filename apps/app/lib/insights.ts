import { conversationOutcome, type Outcome } from "@/lib/conversation-outcome"
import { ticketSignals, type TicketBasis } from "@/lib/ticket-signals"
import { rankTopics } from "@/lib/topics"
import type { AnswerEvidence } from "@/lib/evidence"

/**
 * What the pilot actually produced, as five things a protocol lead can act on.
 *
 * THE RULE THAT SHAPES ALL OF THIS: no percentages. Every section returns
 * counts. A beta runs on tens of conversations, and "67% of testers" from three
 * people is the kind of number a sharp reviewer checks first and never trusts
 * again. Counts survive small samples; rates invent confidence the data cannot
 * support. `smallSample` is returned so the interface can say so out loud.
 *
 * DELIBERATELY NOT A WORD CLOUD. Frequency encoded as area reads badly, and it
 * throws away what makes support text valuable: what the person was trying to
 * DO. Themes are a ranked list with counts and a route back to the
 * conversations, which is the same information a reader can actually use.
 */

/**
 * PURE. No database, no `next/headers`, no React `cache()`.
 *
 * SPLIT THE SAME WAY `roles.ts` AND `roles-server.ts` ARE, and for a reason
 * that bit immediately: importing the loader pulled React's `cache()` into
 * every consumer, which is a no-op outside a request and simply absent in a
 * test runner. The rules below are the part worth testing, so they must be
 * reachable without a Supabase client. `lib/insight-data.ts` holds the read.
 */

/** Below this, report counts and nothing that looks like a rate. */
export const SMALL_SAMPLE = 30

export interface WindowConversation {
  id: string
  created_at: string
  summary: string | null
  category: string | null
  sentiment: string | null
}

export interface WindowMessage {
  conversation_id: string
  role: string
  content: string | null
  created_at: string | null
  feedback: number | null
  evidence: AnswerEvidence | null
}

export interface WindowTicket {
  id: string
  ref: string | null
  conversation_id: string | null
  reason: string | null
  created_at: string | null
}

export interface InsightWindow {
  conversations: WindowConversation[]
  messages: WindowMessage[]
  tickets: WindowTicket[]
  /** True when the conversation cap was reached, so callers can say so. */
  truncated: boolean
}

/** Messages grouped by conversation, oldest first. */
export function messagesByConversation(messages: WindowMessage[]): Map<string, WindowMessage[]> {
  const byConv = new Map<string, WindowMessage[]>()
  for (const m of messages) {
    const list = byConv.get(m.conversation_id)
    if (list) list.push(m)
    else byConv.set(m.conversation_id, [m])
  }
  // Ordering is NOT guaranteed by the query and several rules depend on it:
  // "the last message is the user's" is the whole basis of the unanswered
  // outcome, and pairing a failed search with its question walks backwards
  // from the answer. Sorting here means no caller has to remember.
  for (const list of byConv.values()) {
    list.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
  }
  return byConv
}

/** A documentation search that came back with nothing, or nearly nothing. */
export interface DocGapQuestion {
  question: string
  conversationId: string
  createdAt: string
  /** `none` matched nothing at all; `weak` matched, but badly. */
  kind: "none" | "weak"
  topScore: number | null
}

export interface Theme {
  phrase: string
  count: number
  example: string
  conversationIds: string[]
}

export interface ScreenReport {
  /** Origin + path. Query strings are stripped before storage. */
  url: string
  bugs: number
  feedback: number
  conversations: number
}

export interface Insights {
  days: number
  conversations: number
  /** True when there is too little data for any rate to mean anything. */
  smallSample: boolean
  /** The window hit its cap, so these cover the most recent slice only. */
  truncated: boolean

  outcomes: { outcome: Outcome; count: number }[]
  basis: { basis: TicketBasis; count: number }[]
  docGaps: DocGapQuestion[]
  themes: Theme[]
  screens: ScreenReport[]
  /** Findings whose conversation never recorded a page. Never hidden. */
  screensUnknown: number
}

/**
 * Matched, but badly enough that the answer should not lean on it. Retrieval
 * only returns results above 0.35, so this marks the band just above the floor.
 * Shared with the gaps report deliberately: two different numbers for "weak"
 * in two places is how a threshold quietly stops meaning anything.
 */
export const WEAK_MATCH = 0.5

/** Bug and feedback tickets are findings. Everything else is support. */
const FINDING_REASONS = new Set(["bug", "feedback"])

/**
 * PURE, and separate from the read on purpose. Every rule worth getting right
 * is in here: which question a failed retrieval belongs to, which screen a
 * finding is attributed to, what counts as a theme. Testing those through a
 * Supabase call would mean not testing them.
 */
export function computeInsights(
  win: InsightWindow,
  days: number,
  sessionCap?: number,
): Insights {
  const { conversations, messages, tickets, truncated } = win

  const empty: Insights = {
    days, conversations: 0, smallSample: true, truncated: false,
    outcomes: [], basis: [], docGaps: [], themes: [], screens: [], screensUnknown: 0,
  }
  if (conversations.length === 0) return empty

  const byConv = messagesByConversation(messages)
  const convById = new Map(conversations.map(c => [c.id, c]))

  // ── Outcomes and basis, one pass per conversation ────────────────────────
  const outcomeCounts = new Map<Outcome, number>()
  const basisCounts = new Map<TicketBasis, number>()
  for (const conv of conversations) {
    const msgs = byConv.get(conv.id) ?? []
    const outcome = conversationOutcome({
      messages: msgs.map(m => ({
        role: m.role,
        feedback: m.feedback,
        ...(m.created_at ? { created_at: m.created_at } : {}),
      })),
      ...(sessionCap ? { sessionCap } : {}),
    })
    outcomeCounts.set(outcome, (outcomeCounts.get(outcome) ?? 0) + 1)

    // The SAME worst-case rule the ticket badges use, so a conversation cannot
    // read "Verified" in one place and "Unverified" in another.
    const { basis } = ticketSignals(
      msgs.map(m => ({ role: m.role, feedback: m.feedback, evidence: m.evidence })),
      conv.category,
    )
    basisCounts.set(basis, (basisCounts.get(basis) ?? 0) + 1)
  }

  // ── Documentation gaps, as the QUESTIONS that missed ─────────────────────
  // The question, not the conversation summary. A summary is our words about
  // what happened; the question is the thing somebody has to write a page
  // about, and it is what a docs owner needs in front of them.
  const docGaps: DocGapQuestion[] = []
  for (const conv of conversations) {
    const msgs = byConv.get(conv.id) ?? []
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i]!
      const retrieval = m.evidence?.retrieval
      if (m.role !== "assistant" || !retrieval || typeof retrieval.matched !== "number") continue

      const topScore = typeof retrieval.topScore === "number" ? retrieval.topScore : null
      const kind: "none" | "weak" | null =
        retrieval.matched === 0 ? "none"
          : topScore !== null && topScore < WEAK_MATCH ? "weak"
            : null
      if (!kind) continue

      // The user turn this answer replied to. Walking backwards is what makes
      // the entry readable: an answer with no question above it says nothing.
      let question: string | null = null
      for (let j = i - 1; j >= 0; j--) {
        const prev = msgs[j]!
        if (prev.role === "user" && typeof prev.content === "string" && prev.content.trim().length > 3) {
          question = prev.content.trim().slice(0, 240)
          break
        }
      }
      if (!question) continue

      docGaps.push({
        question,
        conversationId: conv.id,
        createdAt: conv.created_at,
        kind,
        topScore,
      })
    }
  }

  // Nothing matched at all outranks matched-but-weak: an absent page is a
  // clearer instruction than a thin one, and it is cheaper to act on.
  docGaps.sort((a, b) =>
    a.kind === b.kind
      ? b.createdAt.localeCompare(a.createdAt)
      : a.kind === "none" ? -1 : 1,
  )

  // ── Themes ───────────────────────────────────────────────────────────────
  // Over the questions testers ASKED, across every conversation, not only the
  // ones that went badly. The gaps report already ranks failures; this answers
  // the different question of what the beta was about at all.
  const questionsByConv = new Map<string, string[]>()
  for (const m of messages) {
    if (m.role !== "user" || typeof m.content !== "string") continue
    const text = m.content.trim()
    if (text.length <= 3) continue
    const list = questionsByConv.get(m.conversation_id) ?? []
    list.push(text.slice(0, 300))
    questionsByConv.set(m.conversation_id, list)
  }

  const ranked = rankTopics([...questionsByConv.values()].flat())
  const themes: Theme[] = ranked.map(t => {
    const needle = t.phrase.toLowerCase()
    const ids: string[] = []
    for (const [convId, questions] of questionsByConv) {
      if (questions.some(q => q.toLowerCase().includes(needle))) ids.push(convId)
    }
    return { ...t, conversationIds: ids.slice(0, 20) }
  })

  // ── Findings by screen ───────────────────────────────────────────────────
  // The page the tester was on, which almost nothing else in support knows.
  // Recorded on the message evidence at the time, so it is where they were
  // when it happened rather than where they were when they got round to
  // reporting it.
  const screens = new Map<string, { bugs: number; feedback: number; convs: Set<string> }>()
  let screensUnknown = 0
  for (const ticket of tickets) {
    if (!ticket.conversation_id || !ticket.reason || !FINDING_REASONS.has(ticket.reason)) continue
    if (!convById.has(ticket.conversation_id)) continue

    const msgs = byConv.get(ticket.conversation_id) ?? []
    // First recorded page in the conversation: the tester may navigate while
    // typing, and where they hit the problem is the useful answer.
    const url = msgs.map(m => m.evidence?.request?.pageUrl).find((u): u is string => typeof u === "string" && u.length > 0)
    if (!url) { screensUnknown++; continue }

    const entry = screens.get(url) ?? { bugs: 0, feedback: 0, convs: new Set<string>() }
    if (ticket.reason === "bug") entry.bugs++
    else entry.feedback++
    entry.convs.add(ticket.conversation_id)
    screens.set(url, entry)
  }

  const outcomeOrder: Outcome[] = ["unanswered", "unhelpful", "capped", "in_progress", "answered"]
  const basisOrder: TicketBasis[] = ["unverified", "unknown", "documented", "verified"]

  return {
    days,
    conversations: conversations.length,
    smallSample: conversations.length < SMALL_SAMPLE,
    truncated,
    // Worst first in both, so the row that needs attention is never below the
    // fold. Zero-count buckets are dropped: an empty category is not a finding.
    outcomes: outcomeOrder
      .map(outcome => ({ outcome, count: outcomeCounts.get(outcome) ?? 0 }))
      .filter(o => o.count > 0),
    basis: basisOrder
      .map(basis => ({ basis, count: basisCounts.get(basis) ?? 0 }))
      .filter(b => b.count > 0),
    docGaps: docGaps.slice(0, 25),
    themes: themes.slice(0, 8),
    screens: [...screens.entries()]
      .map(([url, v]) => ({ url, bugs: v.bugs, feedback: v.feedback, conversations: v.convs.size }))
      .sort((a, b) => (b.bugs + b.feedback) - (a.bugs + a.feedback) || b.bugs - a.bugs)
      .slice(0, 12),
    screensUnknown,
  }
}
