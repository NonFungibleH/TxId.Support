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
  /** Named things this read touched, for the provenance list. */
  sources?: EvidenceSource[]
  /**
   * Every significant digit-sequence this result contained, so a number in the
   * answer can be traced back to something that was actually read.
   */
  numbers?: string[]
}

/**
 * One named thing an answer rested on.
 *
 * WHY A TYPED LIST RATHER THAN PROSE: "the assistant looked at the chain" is
 * not reviewable. "Read `get_position` on 0x50ea… at ledger version 2841…,
 * oracle price 63695.70" is. A reviewer months later needs to reach the same
 * conclusion from the same inputs, and that requires the inputs to be named
 * individually rather than summarised.
 */
export type EvidenceSource =
  /** A documentation page, with the content hash that pins WHICH version. */
  | { kind: "documentation"; url: string; version?: string; changedAt?: string }
  /** A contract or Move module, and the function read from it. */
  | { kind: "contract"; address: string; chain?: string; fn?: string }
  /**
   * A transaction. `origin` matters: one the user pasted is a claim about
   * their own history, one we found is a finding of ours, and conflating them
   * misrepresents who asserted what.
   */
  | { kind: "transaction"; hash: string; chain?: string; origin: "looked_up" | "user_supplied" }
  /** A price at read time, with where it came from. */
  | { kind: "price"; asset: string; value: string; via?: string }
  /** A per-user position or account held by the protocol. */
  | { kind: "position"; protocol?: string; account: string }
  /** A protocol parameter: a fee, a cap, a paused flag. */
  | { kind: "parameter"; name: string; value: string; via?: string }

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
  const sources: EvidenceSource[] = []
  const numbers = new Set<string>()
  const seen = new Set<string>()
  const add = (s: EvidenceSource) => {
    const k = JSON.stringify(s)
    if (seen.has(k) || sources.length >= 25) return
    seen.add(k)
    sources.push(s)
  }

  walk(result, (key, value, parent) => {
    // Harvest every digit sequence the read returned, in BOTH the raw and the
    // humanized form, because `humanize()` is what produces the string the
    // model is meant to quote and the raw integer is what it came from.
    if (typeof value === "string" || typeof value === "number") {
      for (const d of String(value).matchAll(/\d[\d,.]*/g)) {
        const digits = d[0].replace(/[^0-9]/g, "")
        if (digits.length >= 3 && numbers.size < 400) numbers.add(digits)
      }
    }
    // Addresses, hashes and account objects are what a reviewer re-reads.
    if (typeof value === "string") {
      if ((key === "hash" || key === "transactionHash") && /^0x[a-fA-F0-9]{64}$/.test(value)) {
        add({ kind: "transaction", hash: value, origin: "looked_up",
              ...(typeof parent.chain === "string" ? { chain: parent.chain } : {}) })
      }
      if ((key === "contractAddress" || key === "moduleAddress") && value.startsWith("0x")) {
        add({ kind: "contract", address: value,
              ...(typeof parent.chain === "string" ? { chain: parent.chain } : {}),
              ...(typeof parent.functionName === "string" ? { fn: parent.functionName } : {}) })
      }
      if (key === "accountAddress" && value.startsWith("0x")) {
        add({ kind: "position", account: value,
              ...(typeof parent.protocol === "string" ? { protocol: parent.protocol } : {}) })
      }
    }
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
    // Tools that could not complete a read set `lookupFailed: true` beside their
    // note. That is the contract; the regex below is the legacy fallback for a
    // note written before the marker existed. The record of "what did not run"
    // used to depend entirely on how a sentence was phrased, and it was already
    // missing sanctions ("Could not screen") and the transaction path.
    if (key === "lookupFailed" && value === true) {
      const note = typeof parent.note === "string" ? parent.note : "lookup failed"
      failed.push(note.slice(0, 120))
    }
    if (key === "note" && typeof value === "string" && /lookup failed|could not reach|not read/i.test(value)) {
      failed.push(value.slice(0, 120))
    }
  })

  // Prices are provenance too, so they appear in both shapes: the flat map for
  // the existing pricesAtRead field, and the typed list for the source trail.
  for (const [asset, value] of Object.entries(prices)) add({ kind: "price", asset, value, via: tool })

  if (Object.keys(prices).length > 0) evidence.prices = prices
  if (failed.length > 0) evidence.failed = failed.slice(0, 6)
  if (sources.length > 0) evidence.sources = sources
  if (numbers.size > 0) evidence.numbers = [...numbers]
  return evidence
}

/** Merge per-call evidence into one record for the message. */
export function mergeToolEvidence(items: ToolEvidence[]): {
  toolsUsed: string[]
  failedLookups: string[]
  prices: Record<string, string>
  sources: EvidenceSource[]
  /** Digit sequences seen across every read, for numeric verification. */
  numbers: Set<string>
  /** True when at least one read actually succeeded. Drives grounding. */
  anyReadSucceeded: boolean
} {
  const toolsUsed: string[] = []
  const failedLookups: string[] = []
  const prices: Record<string, string> = {}
  const sources: EvidenceSource[] = []
  const numbers = new Set<string>()
  const seenSource = new Set<string>()
  let anyReadSucceeded = false
  for (const item of items) {
    if (item.ok) anyReadSucceeded = true
    for (const n of item.numbers ?? []) numbers.add(n)
    for (const s of item.sources ?? []) {
      const k = JSON.stringify(s)
      if (!seenSource.has(k) && sources.length < 40) { seenSource.add(k); sources.push(s) }
    }
    if (!toolsUsed.includes(item.tool)) toolsUsed.push(item.tool)
    if (!item.ok && !failedLookups.includes(`${item.tool}: execution failed`)) {
      failedLookups.push(`${item.tool}: execution failed`)
    }
    for (const f of item.failed ?? []) if (!failedLookups.includes(f)) failedLookups.push(f)
    Object.assign(prices, item.prices ?? {})
  }
  return { toolsUsed, failedLookups, prices, sources, numbers, anyReadSucceeded }
}
