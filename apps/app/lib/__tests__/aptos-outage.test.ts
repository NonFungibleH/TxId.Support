import { describe, it, expect, vi, afterEach } from "vitest"
import { lookupFailed } from "@/lib/resolution/adapt"
import { resolve } from "@/lib/resolution/resolve"

/**
 * The same rule as resolution-outage.test.ts, on the Aptos arm.
 *
 * `gather.ts` caught every Aptos read failure with `.catch(() => null)` and
 * fell through to `notFound`, which resolves to TXID-9003.
 *
 * BE PRECISE ABOUT THE HARM HERE, because 9003 is already INDETERMINATE and
 * already says custody "unknown": the API was not making a false custody claim.
 * What it was doing is giving a false EXPLANATION. 9003 tells the user their
 * transaction "may never have been broadcast, may have expired, may be on a
 * different network", and sends them to a block explorer for the same hash.
 * Every one of those is a statement about their transaction, offered when the
 * only thing that actually happened is that we could not reach a node. 9004
 * says there is not enough information and escalates, which is the truth.
 */
const AT = "2026-09-07T12:00:00.000Z"
const H = "0x" + "c".repeat(64)

describe("an unreachable Aptos fullnode is insufficient evidence, not a missing transaction", () => {
  const r = resolve(lookupFailed(H, { observedAt: AT }, "the Aptos fullnode returned 503"))

  it("is not classified as a transaction that could not be found", () => {
    expect(r.txid_code).toBe("TXID-9004")
    expect(r.txid_code).not.toBe("TXID-9003")
  })

  it("claims nothing about custody or retrying", () => {
    expect(r.custody).toBe("unknown")
    expect(r.retryable).toBe("unknown")
  })

  it("is not reported as a plain failure", () => {
    expect(r.status).toBe("indeterminate")
  })

  it("carries the node's own wording so an operator can act on it", () => {
    expect(JSON.stringify(r)).toContain("503")
  })
})

/**
 * The end-to-end path, with the fullnode down and nothing else asked.
 * resolveByHash must reach TXID-9004 rather than notFound.
 */
describe("resolveByHash on a dead Aptos fullnode", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("does not resolve to not_found", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: false, status: 503, headers: new Headers(), json: async () => ({}),
    }) as unknown as Response))
    const { resolveByHash } = await import("@/lib/resolution/gather")
    const r = await resolveByHash(H, { chain: "aptos", observedAt: AT })
    expect(r.txid_code).toBe("TXID-9004")
    expect(r.custody).toBe("unknown")
  })
})
