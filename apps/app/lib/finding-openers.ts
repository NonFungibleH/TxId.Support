/**
 * The fixed messages the widget's mode buttons send.
 *
 * SHARED, because two things need to agree on them and they were drifting: the
 * widget sends them, and the dashboard reads them back to tell a bug thread
 * from a support thread. A copy in each place is a copy that gets edited once.
 *
 * Deriving the kind from the opener rather than storing it means it works on
 * every conversation already recorded, and needs no column. Same reasoning as
 * `conversation-source.ts`, which reads the session id prefix.
 */
export const FEEDBACK_OPENER = "I want to leave feedback on the beta."
export const BUG_OPENER = "I want to report a bug."

export type FindingKind = "bug" | "feedback"

/**
 * Was this conversation a bug report or a piece of feedback?
 *
 * Checks the FIRST user message only. A tester who files a bug and then asks a
 * question is having a support conversation that began with a report, and
 * labelling the whole thread by something said in the middle of it would make
 * the badge unreliable exactly where it matters.
 */
export function findingKindOf(messages: { role: string; content: string }[]): FindingKind | null {
  const firstUser = messages.find(m => m.role === "user")
  if (!firstUser) return null
  const text = firstUser.content.trim()
  if (text === BUG_OPENER) return "bug"
  if (text === FEEDBACK_OPENER) return "feedback"
  return null
}
