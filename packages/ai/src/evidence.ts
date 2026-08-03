/**
 * Compact, storable facts about what an investigation actually read.
 *
 * The full tool results are far too large to keep on every message, and most
 * of their bulk is raw chain structs nobody will re-read. What a reviewer needs
 * is narrower: which tools ran, which lookups failed, and the prices the answer
 * rested on, since "you were down $312" means nothing later without the price
 * that produced it.
 */
export interface ToolEvidence {
  tool: string
  ok: boolean
  /** Market or asset -> price quoted at read time. */
  prices?: Record<string, string>
  /** Reads that failed, so a thin answer is never mistaken for a complete one. */
  failed?: string[]
}

/** Every string field on an object graph, bounded so a deep result can't run away. */
function walk(
  node: unknown,
  visit: (key: string, value: unknown, parent: Record<string, unknown>) => void,
  depth = 0,
): void {
  if (depth > 6 || node === null || typeof node !== "object") return
  if (Array.isArray(node)) {
    for (const item of node.slice(0, 40)) walk(item, visit, depth + 1)
    return
  }
  const obj = node as Record<string, unknown>
  for (const [key, value] of Object.entries(obj)) {
    visit(key, value, obj)
    walk(value, visit, depth + 1)
  }
}

/**
 * Pull the price snapshot and any failed lookups out of one tool result.
 * Purely additive: it never changes what the model sees.
 */
export function toolEvidenceFrom(tool: string, result: unknown, errored: boolean): ToolEvidence {
  const evidence: ToolEvidence = { tool, ok: !errored }
  if (errored || result === null || typeof result !== "object") return evidence

  const prices: Record<string, string> = {}
  const failed: string[] = []

  walk(result, (key, value, parent) => {
    // A price quoted against a named market is the pair worth keeping.
    if ((key === "currentPrice" || key === "entryPrice") && typeof value === "string") {
      const market = typeof parent.market === "string" ? parent.market : null
      if (market) prices[`${market} ${key === "currentPrice" ? "at read" : "at entry"}`] = value
    }
    if (key === "priceUsd" || key === "price" || key === "nativePrice") {
      if (typeof value === "string" || typeof value === "number") {
        const symbol = typeof parent.symbol === "string" ? parent.symbol : "price"
        prices[symbol] = String(value)
      }
    }
    // The codebase says "lookup failed" in the note whenever a read did not
    // happen, precisely so it is never read as a statement about the account.
    if (key === "note" && typeof value === "string" && /lookup failed|could not reach|not read/i.test(value)) {
      failed.push(value.slice(0, 120))
    }
  })

  if (Object.keys(prices).length > 0) evidence.prices = prices
  if (failed.length > 0) evidence.failed = failed.slice(0, 6)
  return evidence
}

/** Merge per-call evidence into one record for the message. */
export function mergeToolEvidence(items: ToolEvidence[]): {
  toolsUsed: string[]
  failedLookups: string[]
  prices: Record<string, string>
} {
  const toolsUsed: string[] = []
  const failedLookups: string[] = []
  const prices: Record<string, string> = {}
  for (const item of items) {
    if (!toolsUsed.includes(item.tool)) toolsUsed.push(item.tool)
    if (!item.ok && !failedLookups.includes(`${item.tool}: execution failed`)) {
      failedLookups.push(`${item.tool}: execution failed`)
    }
    for (const f of item.failed ?? []) if (!failedLookups.includes(f)) failedLookups.push(f)
    Object.assign(prices, item.prices ?? {})
  }
  return { toolsUsed, failedLookups, prices }
}
