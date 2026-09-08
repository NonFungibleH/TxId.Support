import { describe, it, expect, vi } from "vitest"
import { fromEvmDiagnosis } from "@/lib/resolution/adapt"
import { resolve } from "@/lib/resolution/resolve"

/**
 * The API must never turn an outage into "submit it again".
 *
 * /api/v1/resolve returns structured facts to an integrator's own error
 * screen, with no model in between to soften them. TXID-3008 (DROPPED) says
 * custody "unchanged", retryable "yes", RETRY_AS_IS, "it never executed, so
 * nothing moved, submit it again". Every one of those is a claim about the
 * user's money, and an unreachable RPC is evidence of none of them.
 *
 * A diagnosis of lookup_failed must land on INSUFFICIENT_EVIDENCE, whose
 * custody and retryability are both "unknown", because that is what we know.
 */

const AT = "2026-09-02T22:00:00.000Z"
const H = "0x" + "b".repeat(64)

describe("an unreachable node resolves to insufficient evidence", () => {
  const input = fromEvmDiagnosis(
    { status: "not_found", chainId: "0x38", cause: "lookup_failed", explanation: "The BNB Chain node could not be reached." },
    H, { observedAt: AT },
  )
  const r = resolve(input)

  it("is not classified as dropped", () => {
    expect(r.txid_code).not.toBe("TXID-3008")
    expect(r.txid_code).toBe("TXID-9004")
  })

  it("does not claim custody is unchanged", () => {
    expect(r.custody, "we did not reach the chain, so we do not know where the funds are").toBe("unknown")
  })

  it("does not tell anyone to resubmit", () => {
    expect(r.retryable).not.toBe("yes")
    expect(r.recommended_action).not.toBe("RETRY_AS_IS")
  })

  it("does not claim the transaction never executed", () => {
    expect(r.summary).not.toMatch(/never executed|nothing moved|dropped/i)
    expect(r.detail ?? "").not.toMatch(/never executed|nothing moved/i)
  })

  it("carries the node's own wording so the caller can see why", () => {
    expect(r.raw).toMatch(/could not be reached/i)
  })

  it("is honest about its basis", () => {
    expect(r.basis).toBe("indeterminate")
  })
})

describe("a real dropped answer is still dropped", () => {
  // The fix must leave the genuine case alone, or the API loses a real
  // diagnosis to avoid a false one.
  it("classifies a node's null answer as TXID-3008", () => {
    const input = fromEvmDiagnosis(
      { status: "not_found", chainId: "0x38", cause: "dropped", explanation: "This transaction hash isn't known to the network." },
      H, { observedAt: AT },
    )
    expect(resolve(input).txid_code).toBe("TXID-3008")
  })
})

describe("an unexpected throw is not an absence", () => {
  /**
   * Bug #72 in the EVM arm, narrower but the same shape.
   *
   * The NORMAL unreachable path is fine: diagnoseTransaction returns
   * cause "lookup_failed" rather than throwing. But `.catch(() => null)`
   * turned an UNEXPECTED throw into null, which fell past every branch and
   * resolved to notFound. notFound asserts `onchain: "not_found"`, which
   * carries a custody claim, and the spec says an integrator draws a Retry
   * button from custody. The Aptos arm beside it already kept the two apart.
   */
  it("resolves a thrown EVM diagnosis to indeterminate, never not_found", async () => {
    vi.resetModules()
    vi.doMock("@txid/blockchain", async (orig) => ({
      ...(await orig<Record<string, unknown>>()),
      diagnoseTransaction: vi.fn(async () => { throw new Error("unexpected") }),
    }))
    const { resolveByHash } = await import("../resolution/gather")
    const r = await resolveByHash("0x" + "a".repeat(64), { chain: "0x1" })
    // Custody must not be claimed off a call that blew up.
    expect(r.status).not.toBe("failed")
    expect(r.custody).not.toBe("unchanged")
    expect(r.txid_code).toBe("TXID-9004")
    vi.doUnmock("@txid/blockchain")
  })
})
