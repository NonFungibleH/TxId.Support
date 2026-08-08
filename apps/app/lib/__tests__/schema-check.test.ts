import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * The guard that would have caught three separate production incidents.
 *
 * The subtle requirement is the one tested last: a permission or connection
 * error must NOT be reported as a missing table. Telling someone to write a
 * migration for a table that already exists sends them a long way in the wrong
 * direction, which is the same failure the guard is meant to prevent.
 */

const errors: Record<string, { code?: string; message?: string } | null> = {}

vi.mock("../supabase/server", () => ({
  createServiceClient: () => ({
    from: (table: string) => ({
      select: () => ({
        limit: async () => ({ error: errors[table] ?? null }),
      }),
    }),
  }),
}))

const { checkSchema, EXPECTED_TABLES } = await import("../schema-check")

beforeEach(() => {
  for (const k of Object.keys(errors)) delete errors[k]
})

describe("checkSchema", () => {
  it("reports nothing when every table is present", async () => {
    const report = await checkSchema()
    expect(report.missing).toEqual([])
    expect(report.checked).toBe(Object.keys(EXPECTED_TABLES).length)
    expect(report.inconclusive).toBe(false)
  })

  it("names a missing table and what it costs", async () => {
    // webhook_logs absent is the real incident: dispatchEscalation threw, and
    // the Tickets page read as "nobody has escalated anything".
    errors.webhook_logs = { code: "42P01", message: 'relation "webhook_logs" does not exist' }
    const report = await checkSchema()
    expect(report.missing).toHaveLength(1)
    expect(report.missing[0]!.table).toBe("webhook_logs")
    expect(report.missing[0]!.impact).toMatch(/escalation/i)
  })

  it("recognises PostgREST's schema-cache miss as well as Postgres's error", async () => {
    errors.token_usage = { code: "PGRST205", message: "Could not find the table 'public.token_usage'" }
    const report = await checkSchema()
    expect(report.missing.map(m => m.table)).toEqual(["token_usage"])
  })

  it("finds several at once, which is what actually happened", async () => {
    errors.webhook_logs = { code: "42P01" }
    errors.token_usage = { code: "42P01" }
    errors.action_events = { code: "42P01" }
    const report = await checkSchema()
    expect(report.missing.map(m => m.table).sort()).toEqual(
      ["action_events", "token_usage", "webhook_logs"],
    )
  })

  it("does NOT call a permission error a missing table", async () => {
    errors.audit_logs = { code: "42501", message: "permission denied for table audit_logs" }
    const report = await checkSchema()
    expect(report.missing).toEqual([])
  })
})
