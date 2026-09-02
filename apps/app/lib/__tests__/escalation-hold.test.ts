import { describe, it, expect } from "vitest"
import { enabledTargets, holdEscalation } from "@/lib/integrations/escalation"

/**
 * A ticket raised during a service update is parked, not lost.
 *
 * /api/tickets suppresses the fan-out while a notice is up, which is right:
 * one incident otherwise pages the team a thousand times. But nothing ever
 * delivered those escalations afterwards; the operator had to remember to go
 * and look. holdEscalation parks one row per enabled destination with
 * next_attempt_at set to when the notice clears, so the retry worker that
 * already exists delivers them on its next pass.
 *
 * Types are derived from the function signatures rather than imported, so
 * the fixtures cannot drift from what the code accepts, and `next build`
 * (which lints test files) has no `any` to object to.
 */
type Supa = Parameters<typeof holdEscalation>[0]
type Ticket = Parameters<typeof holdEscalation>[2]
type Ints = NonNullable<Parameters<typeof holdEscalation>[3]>

const ALL_ON = {
  slack: { enabled: true, webhookUrl: "https://hooks.slack.com/x" },
  discord: { enabled: true, webhookUrl: "https://discord.com/api/webhooks/x" },
  telegram: { enabled: true, chatId: "123" },
  linear: { enabled: true, apiKey: "lin_x", teamId: "T1" },
  github: { enabled: true, token: "ghp_x", repo: "o/r" },
  jira: { enabled: true, apiToken: "j", domain: "x.atlassian.net", projectKey: "SUP" },
} as unknown as Ints

const TICKET = {
  ref: "TX-1234",
  projectName: "Yamata",
  summary: "Withdrawal stuck",
  reason: null,
  userName: null,
  userEmail: null,
  conversation: [],
  disclaimer: null,
} as unknown as Ticket

function fakeSupabase() {
  const inserted: unknown[][] = []
  const client = {
    from: (table: string) => ({
      insert: async (rows: unknown[]) => {
        expect(table).toBe("escalation_deliveries")
        inserted.push(rows)
        return { error: null }
      },
    }),
  } as unknown as Supa
  return { client, inserted }
}

describe("enabledTargets", () => {
  it("lists every destination that is switched on and configured", () => {
    expect(enabledTargets(ALL_ON).sort()).toEqual(["discord", "github", "jira", "linear", "slack", "telegram"])
  })
  it("skips one that is enabled but missing its credential", () => {
    const partial = { ...ALL_ON, slack: { enabled: true, webhookUrl: "" }, jira: { enabled: true, domain: "x" } } as unknown as Ints
    expect(enabledTargets(partial)).not.toContain("slack")
    expect(enabledTargets(partial)).not.toContain("jira")
  })
  it("is empty with no integrations at all", () => {
    expect(enabledTargets(undefined)).toEqual([])
  })
})

describe("holdEscalation", () => {
  it("parks one pending row per enabled destination, due when the notice clears", async () => {
    const { client, inserted } = fakeSupabase()
    const due = "2026-09-03T06:00:00.000Z"
    const two = { slack: ALL_ON.slack, linear: ALL_ON.linear } as unknown as Ints
    const n = await holdEscalation(client, "proj-1", TICKET, two, due)
    expect(n).toBe(2)
    const rows = inserted[0] as Array<Record<string, unknown>>
    expect(rows.map(r => r.target).sort()).toEqual(["linear", "slack"])
    for (const r of rows) {
      expect(r.status).toBe("pending")
      expect(r.next_attempt_at).toBe(due)
      expect(r.ticket_ref).toBe("TX-1234")
      expect(r.project_id).toBe("proj-1")
      expect(r.attempts).toBe(0)
      expect(String(r.last_error)).toMatch(/service update/i)
    }
  })

  it("writes nothing and pages nobody when no destination is configured", async () => {
    const { client, inserted } = fakeSupabase()
    const n = await holdEscalation(client, "proj-1", TICKET, undefined, "2026-09-03T06:00:00.000Z")
    expect(n).toBe(0)
    expect(inserted).toHaveLength(0)
  })

  it("reports zero rather than throwing when the insert fails", async () => {
    const client = { from: () => ({ insert: async () => ({ error: { message: "relation does not exist" } }) }) } as unknown as Supa
    const one = { slack: ALL_ON.slack } as unknown as Ints
    await expect(holdEscalation(client, "p", TICKET, one, "2026-09-03T06:00:00.000Z")).resolves.toBe(0)
  })
})
