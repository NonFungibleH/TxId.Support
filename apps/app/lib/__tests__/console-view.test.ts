import { describe, it, expect } from "vitest"
import {
  outcomeOf, fundsAtRisk, replyFrom, evidenceLabels, toCaseRow, toCaseView, customerOf,
  type ResolutionRow,
} from "../console/view"

/**
 * The mapping from a stored resolution to what the Console shows. Pure, so it
 * is tested exhaustively rather than through a page.
 */
const base: ResolutionRow = {
  id: "r1", created_at: "2026-09-13T10:00:00.000Z", chain: "0x2105", tx_hash: "0xabc",
  protocol_address: null, txid_code: "TXID-2005", category: "BALANCE", status: "failed",
  custody: "unchanged", next_action_owner: "user", retryable: "after_change", basis: "verified",
  summary: "The wallet was short on one side of the pair.", detail: "Nothing was traded.",
  next_step: "Top up and retry.", customer_ref: null, wallet: "0x044696f82fdcba0996ed696dff0a318e9c81e633",
  raw_status: "TransferHelper: TRANSFER_FROM_FAILED", chain_state_at: "118255000", evidence: [],
}

describe("outcome is the Resolution's own status, not a guess at it", () => {
  it("keeps indeterminate as its own outcome, never failed", () => {
    // The resolver returns indeterminate when custody could not be established.
    // "Failed" is a claim about the transaction; this is the absence of one.
    expect(outcomeOf("indeterminate")).toBe("indeterminate")
    expect(outcomeOf("indeterminate")).not.toBe("failed")
  })
  it("maps the two success statuses to succeeded", () => {
    expect(outcomeOf("succeeded")).toBe("succeeded")
    expect(outcomeOf("succeeded_intent_unmet")).toBe("succeeded")
  })
  it("maps pending and not_submitted honestly", () => {
    expect(outcomeOf("pending")).toBe("pending")
    expect(outcomeOf("not_submitted")).toBe("failed")
  })
})

describe("funds at stake reads the engine's custody vocabulary", () => {
  // The first draft tested "funds_with_user" and "no_movement", which the
  // engine never emits, so every live case would have been flagged.
  it("is false for a failed attempt whose custody is unchanged", () => {
    expect(fundsAtRisk("failed", "unchanged")).toBe(false)
  })
  it("is true when a failed attempt left custody unknown, partial or moved", () => {
    expect(fundsAtRisk("failed", "unknown")).toBe(true)
    expect(fundsAtRisk("failed", "partial")).toBe(true)
    expect(fundsAtRisk("pending", "moved")).toBe(true)
    expect(fundsAtRisk("indeterminate", "unknown")).toBe(true)
  })
  it("is never true for a success, which moved funds on purpose", () => {
    expect(fundsAtRisk("succeeded", "moved")).toBe(false)
  })
})

describe("the reply is assembled from the object", () => {
  it("is summary, detail and next step in that order", () => {
    expect(replyFrom({ summary: "A.", detail: "B.", next_step: "C." })).toBe("A. B. C.")
  })
  it("skips the parts the object does not carry, without leaving gaps", () => {
    expect(replyFrom({ summary: "A.", detail: null, next_step: undefined })).toBe("A.")
    expect(replyFrom({ summary: "A.", detail: "  ", next_step: "C." })).toBe("A. C.")
  })
})

describe("evidence is labelled for an auditor", () => {
  it("leads with the height the answer was read at, then the raw chain string", () => {
    const labels = evidenceLabels(base).map(e => e.label)
    expect(labels[0]).toBe("Read at block")
    expect(labels[1]).toBe("Raw status")
  })
  it("says ledger, not block, on Aptos", () => {
    expect(evidenceLabels({ ...base, chain: "aptos" })[0]!.label).toBe("Read at ledger")
  })
  it("marks a hash the user pasted as given, not looked up", () => {
    const rows = evidenceLabels({ ...base, evidence: [{ kind: "transaction", hash: "0x1", origin: "user_supplied" }] })
    expect(rows.find(r => r.value === "0x1")!.label).toBe("Transaction (as given)")
  })
  it("does not show the height twice when an old row carries it as a parameter too", () => {
    const rows = evidenceLabels({ ...base, evidence: [{ kind: "parameter", name: "chain_state_at", value: "118255000" }] })
    expect(rows.filter(r => r.value === "118255000")).toHaveLength(1)
  })
  it("omits a height that was not read rather than inventing one", () => {
    const rows = evidenceLabels({ ...base, chain_state_at: null })
    expect(rows.some(r => /Read at/.test(r.label))).toBe(false)
  })
})

describe("an unmapped wallet is shown as what we know", () => {
  it("labels the row with the shortened address and no email", () => {
    const who = customerOf(base, null)
    expect(who.label).toMatch(/^0x044696f8…/)
    expect(who.email).toBeNull()
    expect(who.id).toBe(base.wallet)
  })
  it("prefers the mapped identity when one is supplied", () => {
    const who = customerOf(base, { id: "acct_1", label: "Devin O.", email: "d@x.example", wallet: base.wallet, chain: "0x2105", since: null })
    expect(who.label).toBe("Devin O.")
  })
})

describe("a case view never claims a chain time it does not hold", () => {
  it("leaves occurredAt null for a live row", () => {
    // A stored resolution carries the height it was READ at, not the block
    // time of the transaction. An audit trail that printed the read time as
    // "event occurred" would be attributing our clock to the chain.
    const v = toCaseView(base, null, [])
    expect(v.occurredAt).toBeNull()
    expect(v.at).toBe(base.created_at)
  })
  it("applies display labels to the engine's values", () => {
    const v = toCaseView(base, null, [])
    expect(v.resolution!.custody).toMatch(/Unchanged/)
    expect(v.resolution!.retryable).toBe("Yes, after a change")
    expect(v.resolution!.nextActionOwner).toBe("User")
    expect(v.chain).toBe("Base")
  })
  it("falls back to the category when a row has no summary", () => {
    const row = toCaseRow({ ...base, summary: null })
    expect(row.intent).toBe("BALANCE failure")
  })
})
