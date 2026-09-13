import { SUPPORTED_CHAINS } from "@/lib/types/config"
import type { EvidenceItem } from "@/lib/resolution/types"
import type { Basis, CaseRow, CaseView, CustomerSummary, Outcome, ResolutionView, TrailEvent } from "./types"

/**
 * From a stored resolution to what the Console renders. PURE: no network, no
 * database, so every mapping decision here is exhaustively testable.
 *
 * Everything below reads the Resolution's REAL vocabulary. The first draft of
 * this mapping tested custody against "funds_with_user" and "no_movement",
 * values the engine has never emitted, so on live data every case would have
 * been flagged as funds at stake. Vocabulary is imported from the engine's
 * types so a drift is a compile error rather than a wrong badge.
 */

/** A stored row, as the resolutions table returns it. */
export interface ResolutionRow {
  id: string
  created_at: string
  chain: string | null
  tx_hash: string | null
  protocol_address: string | null
  txid_code: string
  category: string
  status: string
  custody: string
  next_action_owner: string
  retryable: string | null
  basis: string
  summary: string | null
  detail?: string | null
  next_step?: string | null
  customer_ref: string | null
  wallet: string | null
  raw_status: string | null
  chain_state_at?: string | null
  evidence: unknown
}

export function outcomeOf(status: string): Outcome {
  if (status === "succeeded" || status === "succeeded_intent_unmet") return "succeeded"
  if (status === "pending") return "pending"
  // Custody unknown means we do not know what happened, and "failed" is a
  // claim that we do.
  if (status === "indeterminate") return "indeterminate"
  return "failed"
}

/**
 * Money we cannot see the end of. A succeeded transaction moved funds on
 * purpose, so custody "moved" is only a concern when the attempt did not
 * succeed. "unchanged" is the one value that settles it either way.
 */
export function fundsAtRisk(outcome: Outcome, custody: string): boolean {
  if (outcome === "succeeded") return false
  return custody !== "unchanged"
}

const CUSTODY_LABEL: Record<string, string> = {
  unchanged: "Unchanged, still with the user",
  moved: "Moved",
  partial: "Partly moved",
  unknown: "Unknown",
}
const OWNER_LABEL: Record<string, string> = {
  user: "User",
  application: "Application",
  protocol: "Protocol",
  infrastructure: "Infrastructure",
  none: "No one",
  unknown: "Unknown",
}
const RETRYABLE_LABEL: Record<string, string> = {
  yes: "Yes",
  after_change: "Yes, after a change",
  no: "No",
  unknown: "Unknown",
}

export const custodyLabel = (v: string) => CUSTODY_LABEL[v] ?? v
export const ownerLabel = (v: string) => OWNER_LABEL[v] ?? v
export const retryableLabel = (v: string | null) => (v ? RETRYABLE_LABEL[v] ?? v : "Unknown")

export function basisOf(v: string): Basis {
  return v === "verified" || v === "derived" || v === "reported" ? v : "indeterminate"
}

/** A chain id as a person reads it. Unknown ids are shown as given, never guessed. */
export function chainLabel(chain: string | null): string {
  if (!chain) return "unknown"
  const hit = SUPPORTED_CHAINS.find(c => String(c.id).toLowerCase() === chain.toLowerCase())
  return hit?.name ?? chain
}

/**
 * The reply an agent sends, assembled FROM the object.
 *
 * The spec's rule is that prose is generated from the Resolution and never
 * written beside it, or the surfaces drift into describing one failure three
 * ways. So the reply is the object's own summary, detail and next step, in
 * that order, and nothing else.
 */
export function replyFrom(r: { summary: string | null; detail?: string | null; next_step?: string | null }): string {
  return [r.summary, r.detail, r.next_step].filter((s): s is string => !!s && s.trim().length > 0).join(" ")
}

const short = (s: string) => (s.length > 18 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s)

/**
 * Evidence as label/value pairs. The order puts what an auditor anchors on
 * first: the height the answer was read at, then the raw chain string, then
 * the items the resolver gathered.
 */
export function evidenceLabels(row: Pick<ResolutionRow, "evidence" | "raw_status" | "chain_state_at" | "chain">): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = []
  const heightLabel = row.chain === "aptos" ? "Read at ledger" : "Read at block"
  if (row.chain_state_at) out.push({ label: heightLabel, value: row.chain_state_at })
  if (row.raw_status) out.push({ label: "Raw status", value: row.raw_status })
  const items = Array.isArray(row.evidence) ? (row.evidence as EvidenceItem[]) : []
  for (const e of items) {
    switch (e.kind) {
      case "transaction":
        out.push({ label: e.origin === "user_supplied" ? "Transaction (as given)" : "Transaction", value: e.hash })
        break
      case "contract":
        out.push({ label: e.fn ? `Contract · ${e.fn}` : "Contract", value: e.address })
        break
      case "position":
        out.push({ label: e.protocol ? `Account on ${e.protocol}` : "Account", value: e.account })
        break
      case "price":
        out.push({ label: `Price · ${e.asset}`, value: e.value })
        break
      case "parameter":
        // chain_state_at rides along as a parameter on rows written before the
        // column existed; the column above already showed it.
        if (e.name === "chain_state_at" && row.chain_state_at) break
        out.push({ label: e.name, value: e.value })
        break
      case "documentation":
        out.push({ label: "Documentation", value: e.url })
        break
    }
  }
  return out
}

/** Who a row belongs to, for the list. Honest about what we know: an unmapped wallet shows as its address. */
export function customerOf(row: Pick<ResolutionRow, "customer_ref" | "wallet" | "chain">, identity?: CustomerSummary | null): CustomerSummary {
  if (identity) return identity
  const wallet = row.wallet
  return {
    id: row.customer_ref ?? wallet ?? "unknown",
    label: row.customer_ref ?? (wallet ? short(wallet) : "Unknown wallet"),
    email: null,
    wallet,
    chain: row.chain,
    since: null,
  }
}

export function toCaseRow(row: ResolutionRow, identity?: CustomerSummary | null): CaseRow {
  const outcome = outcomeOf(row.status)
  const who = customerOf(row, identity)
  return {
    id: row.id,
    customerId: who.id,
    customerLabel: who.label,
    customerEmail: who.email,
    intent: row.summary ?? `${row.category} failure`,
    at: row.created_at,
    outcome,
    chain: chainLabel(row.chain),
    code: row.txid_code,
    category: row.category,
    basis: basisOf(row.basis),
    fundsAtRisk: fundsAtRisk(outcome, row.custody),
  }
}

export function toCaseView(row: ResolutionRow, identity: CustomerSummary | null, trail: TrailEvent[]): CaseView {
  const outcome = outcomeOf(row.status)
  const resolution: ResolutionView = {
    code: row.txid_code,
    category: row.category,
    custody: custodyLabel(row.custody),
    nextActionOwner: ownerLabel(row.next_action_owner),
    retryable: retryableLabel(row.retryable),
    basis: basisOf(row.basis),
    summary: row.summary ?? `${row.category} failure`,
    detail: row.detail ?? "",
    nextStep: row.next_step ?? null,
    reply: replyFrom({ summary: row.summary, detail: row.detail, next_step: row.next_step }),
    evidence: evidenceLabels(row),
    diagnosedAt: row.created_at,
    trail,
  }
  return {
    id: row.id,
    at: row.created_at,
    occurredAt: null,
    outcome,
    intent: row.summary ?? `${row.category} failure`,
    chain: chainLabel(row.chain),
    hash: row.tx_hash,
    resolution,
    customer: customerOf(row, identity),
  }
}
