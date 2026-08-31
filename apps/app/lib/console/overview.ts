import { CAUSES, CUSTOMERS } from "./fixtures"

/**
 * Overview figures, derived from the same fixtures the rest of the Console
 * reads so the numbers on one page cannot disagree with another.
 *
 * When the resolutions table lands this becomes a query. Deriving it rather
 * than hardcoding means the swap is one function, not a page rewrite.
 */
export function overview() {
  const interactions = CUSTOMERS.flatMap(c => c.interactions)
  const failures = interactions.filter(i => i.outcome === "failed")
  const pending = interactions.filter(i => i.outcome === "pending")
  const affected = CAUSES.reduce((n, c) => n + c.affected, 0)
  const fundsAtRisk = CAUSES.filter(c => c.fundsAtRisk)
  const verified = interactions.filter(i => i.resolution?.basis === "verified").length
  const withResolution = interactions.filter(i => i.resolution).length

  return {
    affected,
    causes: CAUSES.length,
    unresolved: failures.length + pending.length,
    fundsAtRiskCauses: fundsAtRisk.length,
    // Worst case per case, never an average: averaging is how the one
    // unverifiable answer disappears.
    verifiedShare: withResolution ? Math.round((verified / withResolution) * 100) : 0,
    topCauses: [...CAUSES].sort(
      (a, b) => Number(b.fundsAtRisk) - Number(a.fundsAtRisk) || b.affected - a.affected,
    ).slice(0, 3),
    recent: interactions
      .filter(i => i.resolution)
      .sort((a, b) => +new Date(b.at) - +new Date(a.at))
      .slice(0, 4)
      .map(i => {
        const owner = CUSTOMERS.find(c => c.interactions.some(x => x.id === i.id))!
        return { id: i.id, who: owner.label, intent: i.intent, at: i.at, outcome: i.outcome, code: i.resolution!.code }
      }),
  }
}
