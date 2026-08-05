import type { AnswerEvidence } from "@/lib/evidence"

/**
 * Why a ticket actually reached a human, and how well founded the conversation
 * behind it was.
 *
 * DERIVED, NOT DECLARED. Tickets already carry a `reason`, but the MODEL picks
 * it from a list, which makes it the assistant's own account of why it gave up.
 * Everything here is computed from what the investigation actually did, so it
 * cannot flatter itself, and it works on every ticket already in the database
 * without new instrumentation.
 *
 * DELIBERATELY NOT A CONFIDENCE SCORE. A percentage is a quantitative claim
 * that has to be defended when it is wrong, and it tells a support lead
 * nothing they can act on. "Your documentation does not cover withdrawals" is
 * a task. "62%" is a decoration.
 */

export type TicketReason =
  | "no_answer"
  | "docs_gap"
  | "read_failed"
  | "ungrounded"
  | "untraceable_figures"
  | "marked_unhelpful"
  | "advice_declined"

export const REASON_LABEL: Record<TicketReason, string> = {
  no_answer: "No answer was generated",
  docs_gap: "Your docs did not cover it",
  read_failed: "A live read failed",
  ungrounded: "Answered from general knowledge",
  untraceable_figures: "Figures with no source",
  marked_unhelpful: "User said the answer was wrong",
  advice_declined: "User asked for advice",
}

/** What a support lead should do about it. Shown on hover. */
export const REASON_HELP: Record<TicketReason, string> = {
  no_answer: "The conversation ended on the user's message with no reply. That is ours to fix, not theirs.",
  docs_gap: "The documentation search found nothing. Writing the page prevents the next one.",
  read_failed: "A chain or indexer read did not complete. Infrastructure, so more documentation will not help.",
  ungrounded: "No live read and no documentation matched, so nothing behind this answer can be checked.",
  untraceable_figures: "The answer contained numbers that trace to neither a reading nor your docs.",
  marked_unhelpful: "The user explicitly rejected the answer.",
  advice_declined: "The assistant correctly refused to advise. A human may be able to help within your own policy.",
}

/**
 * How well founded the conversation was, taken as the WORST case across it.
 *
 * Worst rather than average, because one unverifiable answer in an otherwise
 * solid conversation is exactly the one a reviewer needs to see, and averaging
 * is how it disappears.
 */
export type TicketBasis = "verified" | "documented" | "unverified" | "unknown"

export const BASIS_LABEL: Record<TicketBasis, string> = {
  verified: "Verified",
  documented: "From docs",
  unverified: "Unverified",
  unknown: "No record",
}

/** Sort order for triage: the least founded deserve a human first. */
export const BASIS_RANK: Record<TicketBasis, number> = {
  unverified: 0,
  unknown: 1,
  documented: 2,
  verified: 3,
}

export interface TicketSignals {
  reasons: TicketReason[]
  basis: TicketBasis
}

interface SignalMessage {
  role: string
  feedback?: number | null
  evidence?: AnswerEvidence | null
}

export function ticketSignals(
  messages: SignalMessage[],
  conversationCategory?: string | null,
): TicketSignals {
  const reasons = new Set<TicketReason>()
  let basis: TicketBasis = "unknown"

  const assistantMessages = messages.filter(m => m.role === "assistant")
  if (assistantMessages.length === 0 && messages.length > 0) reasons.add("no_answer")

  const last = messages[messages.length - 1]
  if (last?.role === "user" && messages.length > 1) reasons.add("no_answer")

  for (const m of messages) {
    if (m.feedback === -1) reasons.add("marked_unhelpful")
    const e = m.evidence
    if (!e) continue

    if (e.investigation?.failedLookups?.length) reasons.add("read_failed")
    if (e.retrieval && e.retrieval.matched === 0) reasons.add("docs_gap")
    if (e.unverifiedNumbers?.length) reasons.add("untraceable_figures")
    if (e.grounding === "ungrounded") reasons.add("ungrounded")

    // Worst wins, so a single unverifiable answer is never averaged away.
    if (e.grounding === "ungrounded") basis = "unverified"
    else if (e.grounding === "documented" && basis !== "unverified") basis = "documented"
    else if (e.grounding === "verified" && basis === "unknown") basis = "verified"
  }

  if (conversationCategory === "advice-request") reasons.add("advice_declined")

  return { reasons: [...reasons], basis }
}
