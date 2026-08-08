/**
 * How a server action says "you did something we expected you to do wrong".
 *
 * THE PROBLEM THIS SOLVES. Next.js redacts a thrown Error in production: the
 * client receives a generic message and a digest, and the sentence the action
 * author wrote never arrives. Every validation message in this codebase was
 * therefore invisible to the people it was written for. "Maximum of 20 watched
 * contracts per project" reached the user as an unexplained failure, and the
 * only clue was a 500 in a console they will never open.
 *
 * So anything the user can act on is RETURNED as a value. Throwing stays
 * correct for the things they cannot: not signed in, no organisation, a
 * database that refused. Those are ours to fix and theirs to be spared.
 *
 * The rule of thumb: if the answer to "what should they do about it" is a
 * sentence, return it. If it is "nothing, this is our bug", throw.
 */

export interface Refusal {
  ok: false
  /** A plain sentence naming the cause. Shown to the user verbatim. */
  reason: string
  /** Where to go and fix it, when such a place exists. */
  fix?: { label: string; href: string }
}

export type ActionResult<T = object> = ({ ok: true } & T) | Refusal

/** Refuse, with a reason the user can act on. */
export function refuse(reason: string, fix?: { label: string; href: string }): Refusal {
  return fix ? { ok: false, reason, fix } : { ok: false, reason }
}

/**
 * Read any action result as a message, for callers that only want to toast.
 *
 * Exists so a caller cannot accidentally show "[object Object]" or, worse,
 * ignore a refusal entirely and leave the user staring at a form that did
 * nothing. Returns null when the call succeeded.
 */
export function refusalMessage(res: { ok: boolean } & Partial<Refusal>): string | null {
  return res.ok ? null : (res.reason ?? "Something went wrong. Please try again.")
}
