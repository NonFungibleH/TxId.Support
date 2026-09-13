/**
 * The shapes the Console renders.
 *
 * PURE MODULE: types only, plus nothing. Both the live reads (data.ts) and the
 * demo fixtures (fixtures.ts) produce these, and every component consumes only
 * these. That is the boundary that lets /console and /console-demo render the
 * same components: one reads the database, the other reads a file, and neither
 * component can tell.
 */

/**
 * A case's outcome, from the Resolution's own `status` vocabulary.
 *
 * `indeterminate` is its own outcome and is NEVER folded into `failed`. The
 * resolver returns it when custody could not be established, which is the
 * absence of an answer. Rendering that as "Failed" would be a claim about the
 * transaction produced by our inability to read it: the exact bug this
 * codebase exists to keep out.
 */
export type Outcome = "succeeded" | "failed" | "pending" | "indeterminate"

export type Basis = "verified" | "derived" | "reported" | "indeterminate"

/**
 * Every read the Console makes is two-valued at the top level, because a list
 * that came back empty and a list that could not be read are different facts.
 * A page shows "no cases" only for the first; the second says the read failed
 * and that this says nothing about the customers.
 */
export type ConsoleRead<T> =
  | { kind: "ok"; value: T }
  | { kind: "unavailable"; reason: string }

/** One row in the inbox or a customer's timeline. */
export interface CaseRow {
  id: string
  customerId: string
  customerLabel: string
  customerEmail: string | null
  /** The one-line title. For a live row this is the resolution's summary. */
  intent: string
  /** When TxID produced the answer. */
  at: string
  outcome: Outcome
  chain: string
  code: string
  category: string
  basis: Basis
  fundsAtRisk: boolean
}

/** One access event on a case: who did what, when. */
export interface TrailEvent {
  at: string
  actor: string
  event: string
}

/** The resolution as a case page shows it, with display labels already applied. */
export interface ResolutionView {
  code: string
  category: string
  custody: string
  nextActionOwner: string
  retryable: string
  basis: Basis
  summary: string
  detail: string
  nextStep: string | null
  /** The paragraph an agent sends. Derived from the object, never written separately. */
  reply: string
  evidence: { label: string; value: string }[]
  /** When TxID read the chain and produced this answer. */
  diagnosedAt: string
  trail: TrailEvent[]
}

export interface CustomerSummary {
  /** The customer reference when mapped, otherwise the wallet itself. */
  id: string
  label: string
  email: string | null
  wallet: string | null
  chain: string | null
  since: string | null
}

/** One case, in full. */
export interface CaseView {
  id: string
  /** When TxID produced the answer. The only time a live row holds for certain. */
  at: string
  /**
   * When the event was true on chain, if known. NULL when not: a stored
   * resolution carries the height it was read at, not the block time of the
   * transaction, and the two must not be conflated on an audit trail.
   */
  occurredAt: string | null
  outcome: Outcome
  intent: string
  chain: string
  hash: string | null
  resolution: ResolutionView | null
  customer: CustomerSummary
}

export interface CustomerView extends CustomerSummary {
  /** Everything they have done with the protocol's contracts, successes included. */
  timeline: CaseRow[]
}

/** Failures grouped by cause: the queue is a list of causes, never of tickets. */
export interface CauseGroup {
  code: string
  category: string
  title: string
  /** PEOPLE affected, not rows. Forty rows from two customers is two. */
  affected: number
  fundsAtRisk: boolean
  trend: "up" | "flat" | "down"
  owner: string
  firstSeen: string
  sample: string
}

export interface OverviewFigures {
  affected: number
  causes: number
  unresolved: number
  fundsAtRiskCauses: number
  /** Share of resolutions whose basis is verified. Worst case per case, never an average. */
  verifiedShare: number
  topCauses: CauseGroup[]
  recent: { id: string; who: string; intent: string; at: string; outcome: Outcome; code: string }[]
}
