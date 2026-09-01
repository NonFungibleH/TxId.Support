import { describe, it, expect, vi } from "vitest"

/**
 * The Console must render before the migration is applied.
 *
 * Production schema drift is documented in CLAUDE.md as a recurring reality
 * here: migrations have sat unapplied for weeks. A console that 500s because a
 * table is missing turns a deployment gap into an outage, so every read
 * degrades to empty instead. These tests pin that, because it is invisible in
 * the signatures and easy to refactor away.
 */
const from = vi.fn()
vi.mock("@/lib/supabase/server", () => ({ createServiceClient: () => ({ from }) }))

import { listCases, causeGroups, customerCases, caseRowById } from "../console/data"

const missingTable = { message: 'relation "resolutions" does not exist' }

/** A chainable PostgREST stub that ends in the given result. */
function chain(result: unknown) {
  const thenable = {
    select: () => thenable, eq: () => thenable, gte: () => thenable,
    order: () => thenable, limit: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
  }
  return thenable
}

describe("console reads survive a missing table", () => {
  it("listCases returns empty rather than throwing", async () => {
    from.mockReturnValue(chain({ data: null, error: missingTable }))
    await expect(listCases("p1")).resolves.toEqual([])
  })

  it("causeGroups returns empty rather than throwing", async () => {
    from.mockReturnValue(chain({ data: null, error: missingTable }))
    await expect(causeGroups("p1")).resolves.toEqual([])
  })

  it("customerCases returns empty rather than throwing", async () => {
    from.mockReturnValue(chain({ data: null, error: missingTable }))
    await expect(customerCases("p1", "acct_1")).resolves.toEqual([])
  })

  it("caseRowById returns null rather than throwing", async () => {
    from.mockReturnValue(chain({ data: null, error: missingTable }))
    await expect(caseRowById("p1", "x")).resolves.toBeNull()
  })

  it("survives the client itself blowing up", async () => {
    from.mockImplementation(() => { throw new TypeError("client is not a function") })
    let threw: unknown = null
    try { await listCases("p1") } catch (e) { threw = e }
    expect(threw).toBeNull()
  })
})

describe("cause grouping counts PEOPLE, not rows", () => {
  it("forty rows from two customers is two affected, not forty", async () => {
    const rows = Array.from({ length: 40 }, (_, i) => ({
      txid_code: "2103", category: "BALANCE", summary: "Swap ran with no balance",
      custody: "funds_with_user", next_action_owner: "user",
      created_at: new Date(Date.now() - i * 1000).toISOString(),
      customer_ref: i % 2 === 0 ? "acct_a" : "acct_b", wallet: null,
    }))
    from.mockReturnValue(chain({ data: rows, error: null }))
    const groups = await causeGroups("p1")
    expect(groups).toHaveLength(1)
    expect(groups[0]!.affected).toBe(2)
  })

  it("puts funds-at-risk causes first even when fewer people are affected", async () => {
    from.mockReturnValue(chain({
      data: [
        { txid_code: "2103", category: "BALANCE", summary: "no balance", custody: "funds_with_user", next_action_owner: "user", created_at: "2026-08-30T10:00:00Z", customer_ref: "a", wallet: null },
        { txid_code: "2103", category: "BALANCE", summary: "no balance", custody: "funds_with_user", next_action_owner: "user", created_at: "2026-08-30T10:00:00Z", customer_ref: "b", wallet: null },
        { txid_code: "3102", category: "MEMPOOL", summary: "stuck withdrawal", custody: "funds_in_flight", next_action_owner: "user", created_at: "2026-08-30T10:00:00Z", customer_ref: "c", wallet: null },
      ],
      error: null,
    }))
    const groups = await causeGroups("p1")
    expect(groups[0]!.code).toBe("3102")
    expect(groups[0]!.fundsAtRisk).toBe(true)
  })
})
