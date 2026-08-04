/**
 * Rank what users keep asking about, from their own words.
 *
 * Pure and dependency-free on purpose: it is the one piece of the gaps report
 * that is real logic rather than a database query, so it lives where it can be
 * exercised directly instead of only through a Supabase call.
 */

/**
 * Words that carry no topic. Deliberately kept to genuinely empty words: an
 * over-eager list strips the domain terms that make a phrase useful.
 */
const STOPWORDS = new Set([
  "the","a","an","and","or","but","if","then","is","are","was","were","be","been","being",
  "i","my","me","we","our","you","your","it","its","this","that","these","those","they","them",
  "to","of","in","on","at","for","with","from","by","as","about","into","out","up","down","over",
  "do","does","did","done","can","could","will","would","should","shall","may","might","must",
  "have","has","had","get","got","how","what","when","where","why","who","which","not","no",
  "so","just","very","really","any","some","all","there","here","now","still","yet","also",
  "please","help","hi","hello","thanks","thank","im","ive","dont","cant","wont","didnt","isnt",
])

/**
 * Rank what users keep asking about, from their own words.
 *
 * DELIBERATELY NOT AN LLM CALL. This runs on every Analytics load, and a
 * clustering pass that costs money and varies between runs is the wrong shape
 * for a number a team is meant to trust and act on. Bigrams first, because
 * "withdrawal delay" tells a content owner what to write and "delay" does not.
 */
export function rankTopics(questions: string[]): { phrase: string; count: number; example: string }[] {
  const counts = new Map<string, { n: number; example: string }>()

  for (const q of questions) {
    const words = q
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/0x[a-f0-9]{6,}/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOPWORDS.has(w))

    // Each phrase counts once per question, so one rambling message cannot
    // manufacture a trend on its own.
    const seen = new Set<string>()
    for (let i = 0; i < words.length; i++) {
      seen.add(words[i]!)
      if (i + 1 < words.length) seen.add(`${words[i]} ${words[i + 1]}`)
    }
    for (const phrase of seen) {
      const cur = counts.get(phrase)
      if (cur) cur.n++
      else counts.set(phrase, { n: 1, example: q })
    }
  }

  const ranked = [...counts.entries()]
    .filter(([, v]) => v.n >= 2)
    // A bigram is worth more than either of its words, so it wins ties and
    // then suppresses them below.
    .sort((a, b) => b[1].n - a[1].n || b[0].split(" ").length - a[0].split(" ").length)

  const out: { phrase: string; count: number; example: string }[] = []
  const covered = new Set<string>()
  for (const [phrase, v] of ranked) {
    const parts = phrase.split(" ")
    // Skip a single word already represented by a stronger phrase containing it.
    if (parts.length === 1 && covered.has(phrase)) continue
    out.push({ phrase, count: v.n, example: v.example.slice(0, 140) })
    parts.forEach(w => covered.add(w))
    if (out.length >= 8) break
  }
  return out
}
