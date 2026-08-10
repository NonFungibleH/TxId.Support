/**
 * How a conversation ended, derived from what is actually recorded.
 *
 * WHY THIS IS ITS OWN FILE. The rule used to be one inline ternary: if the last
 * message is the user's it was unanswered, otherwise answered. That collapsed
 * several very different endings into one word and produced a badge nobody
 * trusted, which is worse than no badge, because a support lead who has learned
 * to ignore a label will ignore it on the day it matters.
 *
 * WHAT IS DELIBERATELY ABSENT: "resolved". We cannot tell a user who got what
 * they needed and closed the tab from one who gave up and closed the tab. The
 * records are identical. This product already renamed a "Resolved rate" metric
 * for making exactly that claim, and inferring it here would reintroduce it in
 * a new place. The only honest sources of resolution are a thumbs-up or asking
 * the user outright, and asking is a product decision, not an inference.
 *
 * For the same reason there is no "dropped off". A conversation that ends after
 * a good answer looks the same as one abandoned in frustration, and naming it
 * after the user's supposed behaviour blames them for what might be our failure.
 */

export type Outcome =
  /** Very recent, the reply may still be generating. */
  | "in_progress"
  /** The assistant hit the per-session message cap and handed over. */
  | "capped"
  /** A user turn has no reply at all. Our failure, not theirs. */
  | "unanswered"
  /** The user marked an answer unhelpful. */
  | "unhelpful"
  /** Answered, with nothing else to report. Never "resolved". */
  | "answered"

export interface OutcomeInput {
  messages: { role: string; feedback?: number | null; created_at?: string }[]
  /** The per-session user-message cap that applied to this project. */
  sessionCap?: number
  /** Now, injectable so the rule is testable. */
  now?: number
}

/** A reply may still be streaming, so a very recent turn is never a failure. */
const IN_FLIGHT_MS = 2 * 60_000

export function conversationOutcome({ messages, sessionCap, now = Date.now() }: OutcomeInput): Outcome {
  if (messages.length === 0) return "answered"

  const last = messages[messages.length - 1]!
  const userTurns = messages.filter(m => m.role === "user").length

  // CAP FIRST, because it explains the ending better than anything after it.
  // A capped conversation was cut off by us and handed to a human: reading it
  // as "answered" hides that the assistant ran out of room, which is the one
  // thing a protocol needs to know when deciding whether the cap is too low.
  if (sessionCap && sessionCap > 0 && userTurns >= sessionCap) return "capped"

  // Explicit user judgement beats anything we infer.
  if (messages.some(m => typeof m.feedback === "number" && m.feedback < 0)) return "unhelpful"

  if (last.role === "user") {
    const age = last.created_at ? now - new Date(last.created_at).getTime() : Infinity
    return age < IN_FLIGHT_MS ? "in_progress" : "unanswered"
  }

  return "answered"
}

/** Label and tooltip per outcome, so the interface says the same thing everywhere. */
export const OUTCOME_META: Record<Outcome, { label: string; title: string } | null> = {
  // The common case earns no badge. A label on every row is noise, and the
  // exceptions are the only reason to scan the list.
  answered: null,
  in_progress: {
    label: "In progress",
    title: "The last message is very recent, so a reply may still be generating.",
  },
  capped: {
    label: "Hit the message limit",
    title:
      "The assistant reached this project's per-conversation message limit and handed over to your team. The user was not left without a reply. Raise the limit if this happens often.",
  },
  unanswered: {
    label: "No reply generated",
    title:
      "A question was recorded with no answer after it. This is a failure on our side, not the user leaving.",
  },
  unhelpful: {
    label: "Marked unhelpful",
    title: "The user gave an answer in this conversation a thumbs down.",
  },
}
