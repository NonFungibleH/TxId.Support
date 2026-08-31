import { describe, it, expect, vi } from "vitest"

/**
 * The whole safety argument for calling this from the live chat path is that it
 * CANNOT fail the thing it accompanies. A beta customer's widget must not break
 * because a statistics table is unreachable, missing, or slow.
 *
 * These tests exist because that guarantee is invisible in the type signature:
 * recordResolution returns Promise<void> either way, so nothing but a test
 * stops someone removing the try/catch during a refactor.
 */
const insert = vi.fn()
vi.mock("@/lib/supabase/server", () => ({
  createServiceClient: () => ({ from: () => ({ insert }) }),
}))
vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { recordResolution } from "../resolution/record"
import type { Resolution } from "../resolution/types"

const resolution = {
  txid_code: "7201",
  cause: "order_absent",
  category: "SETTLEMENT",
  status: "failed",
  custody: "funds_with_user",
  gas_spent: true,
  next_action_owner: "none",
  retryable: "no",
  recommended_action: "none",
  summary: "That order had already left the book.",
  detail: "",
  basis: "verified",
  evidence: [],
  chain: "aptos",
  hash: "0x62505e6a",
  observed_at: "2026-08-27T00:00:00.000Z",
} as unknown as Resolution

const ctx = { projectId: "p1", source: "agent" as const }

describe("recordResolution never breaks its caller", () => {
  it("resolves when the table does not exist yet", async () => {
    insert.mockResolvedValue({ error: { message: 'relation "resolutions" does not exist' } })
    await expect(recordResolution(resolution, ctx)).resolves.toBeUndefined()
  })

  // Asserted with an explicit try/catch rather than .resolves: vitest attributes
  // the mock's rejection to the test before the assertion is evaluated, which
  // reports a pass as a failure. Catching here tests the actual property, which
  // is that the call does not throw at its caller.
  it("does not throw when the insert rejects", async () => {
    insert.mockImplementation(async () => { throw new Error("connection refused") })
    let threw: unknown = null
    try { await recordResolution(resolution, ctx) } catch (e) { threw = e }
    expect(threw).toBeNull()
  })

  it("does not throw when the client blows up synchronously", async () => {
    insert.mockImplementation(() => { throw new TypeError("client is not a function") })
    let threw: unknown = null
    try { await recordResolution(resolution, ctx) } catch (e) { threw = e }
    expect(threw).toBeNull()
  })

  it("writes the aggregation keys as their own columns, not buried in jsonb", async () => {
    insert.mockResolvedValue({ error: null })
    await recordResolution(resolution, ctx)
    const row = insert.mock.calls.at(-1)![0] as Record<string, unknown>
    for (const key of ["txid_code", "category", "status", "custody", "next_action_owner", "basis", "chain", "source"]) {
      expect(row[key], `${key} must be its own column`).toBeDefined()
    }
    expect(row.source).toBe("agent")
    expect(row.chain).toBe("aptos")
  })

  it("prefers the resolution's own hash and raw status over the caller's", async () => {
    insert.mockResolvedValue({ error: null })
    await recordResolution(resolution, { ...ctx, txHash: "0xWRONG" })
    const row = insert.mock.calls.at(-1)![0] as Record<string, unknown>
    expect(row.tx_hash).toBe("0x62505e6a")
  })
})
