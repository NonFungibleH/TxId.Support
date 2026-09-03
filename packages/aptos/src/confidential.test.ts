import { describe, it, expect, vi, afterEach } from "vitest"
import { getConfidentialState, confidentialNote } from "./confidential"

/**
 * A hidden balance is not an absent one.
 *
 * `0x1::confidential_asset` is live on mainnet and Petra offers it to everyone
 * as "Confidential APT". Enabling it moves APT out of the visible
 * fungible-asset store, so it disappears from the Indexer table our balance
 * read queries. Reading only that table tells a holder their balance is
 * smaller than it is, and tells someone who moved all of it that their wallet
 * is empty.
 *
 * We cannot read the amount, and these tests exist partly to keep it that way:
 * the note must never contain a figure. What we can read, with no key, is that
 * a store exists, plus the three operational states that generate the actual
 * support questions.
 */
const A = "0x" + "3".repeat(64)
const ok = (v: unknown) => ({ ok: true, status: 200, json: async () => [v], headers: new Headers() }) as unknown as Response
const aborted = () => ({ ok: false, status: 400, json: async () => ({ message: "resource not found" }), headers: new Headers() }) as unknown as Response
const down = () => ({ ok: false, status: 503, json: async () => ({}), headers: new Headers() }) as unknown as Response

/** Answer each view by name. Unlisted views come back aborted. */
function views(map: Record<string, unknown>) {
  return vi.fn(async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { function?: string }
    const name = (body.function ?? "").split("::").pop() ?? ""
    if (!(name in map)) return aborted()
    const v = map[name]
    return v === "DOWN" ? down() : ok(v)
  })
}

afterEach(() => vi.unstubAllGlobals())

describe("getConfidentialState", () => {
  it("reports a store that exists", async () => {
    vi.stubGlobal("fetch", views({
      has_confidential_store: true,
      get_num_transfers_received: "0",
      is_normalized: true,
      incoming_transfers_paused: false,
    }))
    const s = await getConfidentialState(A)
    expect(s).toEqual({ hasStore: true, transfersPending: 0, normalized: true, incomingPaused: false })
  })

  it("reports no store as a real finding, not a failure", async () => {
    vi.stubGlobal("fetch", views({ has_confidential_store: false }))
    const s = await getConfidentialState(A)
    expect(s?.hasStore).toBe(false)
  })

  it("treats an aborted presence view as 'no store', because the resource is absent", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => aborted()))
    const s = await getConfidentialState(A)
    expect(s?.hasStore).toBe(false)
  })

  it("returns NULL when the node could not be reached, never 'no store'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => down()))
    expect(await getConfidentialState(A), "an outage must not read as 'no confidential balance'").toBeNull()
  })

  it("keeps the presence finding when only a detail view fails", async () => {
    // A rate-limited flag must not discard the part that stops us saying "empty".
    vi.stubGlobal("fetch", views({
      has_confidential_store: true,
      get_num_transfers_received: "DOWN",
      is_normalized: true,
      incoming_transfers_paused: false,
    }))
    const s = await getConfidentialState(A)
    expect(s?.hasStore).toBe(true)
    expect(s?.transfersPending).toBeNull()
    expect(s?.normalized).toBe(true)
  })

  it("parses the u64 transfer count from its string form", async () => {
    vi.stubGlobal("fetch", views({
      has_confidential_store: true,
      get_num_transfers_received: "3",
      is_normalized: true,
      incoming_transfers_paused: false,
    }))
    expect((await getConfidentialState(A))?.transfersPending).toBe(3)
  })
})

describe("confidentialNote", () => {
  const base = { hasStore: true, transfersPending: 0, normalized: true, incomingPaused: false }

  it("says nothing at all when there is no confidential balance", () => {
    expect(confidentialNote({ ...base, hasStore: false })).toBeNull()
  })

  it("tells the model the visible balance is not the whole holding", () => {
    const n = confidentialNote(base)!
    expect(n).toMatch(/HOLDS A CONFIDENTIAL BALANCE/)
    expect(n).toMatch(/not their whole holding/i)
  })

  it("never contains a figure, because we cannot read one", () => {
    const n = confidentialNote({ ...base, transfersPending: 0 })!
    // Only the encryption language should appear; no digits at all in this case.
    expect(n).not.toMatch(/\d/)
    expect(n).toMatch(/encrypted/i)
    expect(n).toMatch(/must not guess/i)
  })

  it("explains a pending balance, which is the commonest cAPT support question", () => {
    const n = confidentialNote({ ...base, transfersPending: 2 })!
    expect(n).toMatch(/2 confidential transfers have arrived/)
    expect(n).toMatch(/roll(s|ed)? them over|rollover/i)
  })

  it("uses the singular for one transfer", () => {
    expect(confidentialNote({ ...base, transfersPending: 1 })!).toMatch(/1 confidential transfer have|1 confidential transfer /)
  })

  it("leads on normalization when a transfer would fail", () => {
    expect(confidentialNote({ ...base, normalized: false })!).toMatch(/NOT normalized/)
  })

  it("explains paused incoming transfers", () => {
    expect(confidentialNote({ ...base, incomingPaused: true })!).toMatch(/PAUSED incoming/)
  })

  it("a failed check says so, and does not deny a confidential balance", () => {
    const n = confidentialNote(null)!
    expect(n).toMatch(/Could not check/i)
    expect(n).toMatch(/do NOT say they have none/i)
  })
})
