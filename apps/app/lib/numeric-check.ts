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
    already.add(digits)
    if (!traceable(digits, seenFromTools, corpus)) {
      out.push(raw)
      if (out.length >= 8) break
    }
  }
  return out
}
