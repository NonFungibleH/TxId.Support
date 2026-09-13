import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * The Console's reads are two-valued at the top level.
 *
 * The first version "degraded to empty rather than throwing" on every error,
 * including the table not existing. That avoided a 500, which was right, and
 * replaced it with an inbox that said "nothing to do" during an outage, which
 * was the bug this codebase exists to keep out: a lookup that did not
 * complete, presented as a finding. `unavailable` avoids the 500 too, and the
 * page can say so.
 */
const from = vi.fn()
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from }) }))

import { listCases, causeGroups, customerCases, caseViewById } from "../console/data"

const missingTable = { message: 'relation "resolutions" does not exist' }

/** A chainable PostgREST stub: every builder method returns itself, awaiting it yields `result`. */
function chain(result: unknown) {
  const self: Record<string, unknown> = {}
  for (const m of ["select", "eq", "in", "is", "ilike", "gte", "order", "limit", "maybeSingle"]) self[m] = () => self
  self.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(result).then(res, rej)
  return self
}

const row = (over: Record<string, unknown> = {}) => ({
  id: "r1", created_at: "2026-09-13T10:00:00.000Z", chain: "0x2105", tx_hash: "0xabc", protocol_address: null,
  txid_code: "TXID-2005", category: "BALANCE", status: "failed", custody: "unchanged", next_action_owner: "user",
  retryable: "after_change", basis: "verified", summary: "Short on one side", detail: null, next_step: null,
  customer_ref: null, wallet: "0x0000000000000000000000000000000000000001", raw_status: null,
  chain_state_at: null, evidence: [], ...over,
})

beforeEach(() => from.mockReset())

describe("a read that did not complete is unavailable, never an empty list", () => {
  it("listCases", async () => {
    from.mockReturnValue(chain({ data: null, error: missingTable }))
    const r = await listCases("p1")
    expect(r.kind).toBe("unavailable")
  })
  it("causeGroups", async () => {
    from.mockReturnValue(chain({ data: null, error: missingTable }))
    expect((await causeGroups("p1")).kind).toBe("unavailable")
  })
  it("customerCases", async () => {
    from.mockReturnValue(chain({ data: null, error: missingTable }))
    expect((await customerCases("p1", "acct_1")).kind).toBe("unavailable")
  })
  it("caseViewById", async () => {
    from.mockReturnValue(chain({ data: null, error: missingTable }))
    expect((await caseViewById("p1", "r1")).kind).toBe("unavailable")
  })
  it("survives the client itself blowing up, still without a 500", async () => {
    // The throw comes from a plain function on the builder, not from inside
    // the vi.fn: vitest 2.1 reports an exception thrown inside a spy as a test
    // failure even when the code under test catches it, once mockReset has run
    // in beforeEach. The property being pinned is unchanged: a client that
    // blows up mid-chain is unavailable, not empty, and not a 500.
    from.mockReturnValue({ select: () => { throw new TypeError("client is not a function") } })
    const r = await listCases("p1")
    expect(r.kind).toBe("unavailable")
  })
})

describe("an empty answer from a table that answered is a finding", () => {
  it("listCases returns ok with no rows", async () => {
    from.mockReturnValue(chain({ data: [], error: null }))
    const r = await listCases("p1")
    expect(r).toEqual({ kind: "ok", value: [] })
  })
  it("a case that does not exist is ok with null, not unavailable", async () => {
    from.mockReturnValue(chain({ data: null, error: null }))
    const r = await caseViewById("p1", "nope")
    expect(r).toEqual({ kind: "ok", value: null })
  })
})

describe("cause grouping counts PEOPLE, not rows", () => {
  it("forty rows from two customers is two affected", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => row({
      id: `r${i}`, customer_ref: i % 2 === 0 ? "acct_a" : "acct_b", wallet: null,
      created_at: new Date(Date.now() - i * 1000).toISOString(),
    }))
    from.mockReturnValue(chain({ data: rows, error: null }))
    const r = await causeGroups("p1")
    expect(r.kind).toBe("ok")
    if (r.kind !== "ok") throw new Error("narrowing")
    expect(r.value).toHaveLength(1)
    expect(r.value[0]!.affected).toBe(2)
  })

  it("puts funds-at-stake causes first even when fewer people are affected", async () => {
    from.mockReturnValue(chain({ data: [
      row({ id: "a", customer_ref: "a", custody: "unchanged" }),
      row({ id: "b", customer_ref: "b", custody: "unchanged" }),
      row({ id: "c", customer_ref: "c", txid_code: "TXID-3006", category: "MEMPOOL", status: "pending", custody: "unknown" }),
    ], error: null }))
    const r = await causeGroups("p1")
    if (r.kind !== "ok") throw new Error("narrowing")
    expect(r.value[0]!.code).toBe("TXID-3006")
    expect(r.value[0]!.fundsAtRisk).toBe(true)
    expect(r.value[1]!.fundsAtRisk).toBe(false)
  })

  it("uses the engine's custody vocabulary, so an unchanged failure is not at stake", async () => {
    from.mockReturnValue(chain({ data: [row({ custody: "unchanged" })], error: null }))
    const r = await causeGroups("p1")
    if (r.kind !== "ok") throw new Error("narrowing")
    expect(r.value[0]!.fundsAtRisk).toBe(false)
  })
})

describe("the inbox does not dress an indeterminate answer as a failure", () => {
  it("keeps outcome indeterminate", async () => {
    from.mockReturnValue(chain({ data: [row({ status: "indeterminate", custody: "unknown", txid_code: "TXID-9004", category: "INDETERMINATE" })], error: null }))
    const r = await listCases("p1")
    if (r.kind !== "ok") throw new Error("narrowing")
    expect(r.value[0]!.outcome).toBe("indeterminate")
  })
  it("excludes it from the open filter, which is for failures we could establish", async () => {
    from.mockReturnValue(chain({ data: [
      row({ id: "f", status: "failed" }),
      row({ id: "i", status: "indeterminate", custody: "unknown" }),
    ], error: null }))
    const r = await listCases("p1", { status: "open" })
    if (r.kind !== "ok") throw new Error("narrowing")
    expect(r.value.map(c => c.id)).toEqual(["f"])
  })
})
