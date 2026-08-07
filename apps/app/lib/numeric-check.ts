/**
 * Which numbers in an answer cannot be traced to something that was read.
 *
 * WHY THIS EXISTS: the failure that would actually damage a protocol is a
 * confident, specific, wrong NUMBER about a user's own position. Prose that is
 * loosely worded is a documentation problem; "your liquidation price is
 * $2,690" when it is not is the one that ends the relationship.
 *
 * That class is mechanically checkable, because every legitimate figure came
 * from a tool result or a documentation excerpt. A number that appears in
 * neither was produced by the model, and a number produced by the model is a
 * number nobody can check.
 *
 * A DETECTOR, NOT A GATE. It runs after the answer has streamed, so it cannot
 * suppress. What it does is make the failure visible: recorded on the message
 * and surfaced to the team, rather than discovered by a user.
 */

/**
 * Numbers that carry no factual claim, so flagging them is noise.
 * Years, small counts, list positions, percentages the model derived from two
 * figures it did quote, and the ordinary furniture of a sentence.
 */
function isUninteresting(digits: string, raw: string): boolean {
  // Short numbers are counts and ordinals far more often than claims.
  if (digits.length < 3) return true
  // Four digits starting 19xx/20xx inside a date-ish context.
  if (/^(19|20)\d{2}$/.test(digits)) return true
  // Chain ids, block-ish integers and hashes are handled as sources, not claims.
  if (raw.startsWith("0x")) return true
  return false
}

/** Strip formatting so "63,695.70" and "6369570" compare on digits alone. */
function digitsOf(s: string): string {
  return s.replace(/[^0-9]/g, "")
}

/**
 * Words that turn the number after them into a RECOMMENDATION rather than a
 * reading.
 *
 * WHY THIS MATTERS ENOUGH TO EXIST: "increase the gas limit to at least
 * 200,000" is good support, and 200,000 is untraceable BY DEFINITION, because
 * it is a value the user has not set yet. Nothing on chain can contain it. The
 * checker flagged it, so a correct diagnosis of a failed transaction ended with
 * "I could not trace one figure above to a live reading", which reads as doubt
 * about the diagnosis itself.
 *
 * The guardrail is for a confident specific wrong number about the user's own
 * POSITION. A figure the answer tells the user to go and set is a different
 * kind of number, and treating them alike is what makes the signal noise.
 *
 * Deliberately narrow: only imperative, forward-looking cues. Hedges like
 * "about" and "roughly" are NOT here, because "your balance is about 4,812" is
 * still a reported value and still has to be traceable.
 */
const SUGGESTION_CUE =
  /\b(?:increase|increasing|raise|raising|set|setting|bump|adjust|change|retry with|resubmit with|use|using|try|at least|no less than|minimum(?: of)?|recommend(?:ed|s)?|suggest(?:ed|s)?|up to)\b[^.!?]{0,40}$/i

/** How much text before the figure is inspected for a cue. */
const CUE_WINDOW = 60

/**
 * Does this figure appear in anything we actually read?
 *
 * Substring rather than equality on purpose: the model is SUPPOSED to format
 * and round, so "$63,695.70" quoted from a raw `63695700000` shares a digit
 * prefix rather than matching it. Requiring equality would flag every
 * correctly formatted number, which would make the signal useless and get it
 * switched off.
 */
function traceable(digits: string, seen: Set<string>, corpus: string): boolean {
  if (seen.has(digits)) return true
  for (const s of seen) {
    if (s.includes(digits) || digits.includes(s)) {
      // Require a meaningful overlap, so "100" does not match everything.
      const shorter = Math.min(s.length, digits.length)
      if (shorter >= 3) return true
    }
  }
  return corpus.includes(digits)
}

/**
 * Returns the figures in `answer` that appear in neither the tool results nor
 * the retrieved documentation. Capped, because a long list is noise and the
 * first few are what a reviewer reads.
 */
export function unverifiedNumbers(
  answer: string,
  seenFromTools: Set<string>,
  ragContext: string,
): string[] {
  if (!answer) return []
  const corpus = digitsOf(ragContext)
  const out: string[] = []
  const already = new Set<string>()

  for (const m of answer.matchAll(/(?:0x[a-fA-F0-9]+|\d[\d,]*(?:\.\d+)?%?)/g)) {
    const raw = m[0]
    const digits = digitsOf(raw)
    if (!digits || isUninteresting(digits, raw)) continue
    if (already.has(digits)) continue
    // A value the answer tells the user to GO AND SET cannot be traced to a
    // reading, because it does not exist yet. Checked before `already` is
    // marked, so the same figure asserted as fact later in the answer is
    // still caught.
    const before = answer.slice(Math.max(0, (m.index ?? 0) - CUE_WINDOW), m.index ?? 0)
    if (SUGGESTION_CUE.test(before)) continue
    already.add(digits)
    if (!traceable(digits, seenFromTools, corpus)) {
      out.push(raw)
      if (out.length >= 8) break
    }
  }
  return out
}
