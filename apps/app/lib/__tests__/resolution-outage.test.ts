import { describe, it, expect } from "vitest"
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
