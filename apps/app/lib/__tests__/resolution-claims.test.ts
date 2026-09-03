import { describe, it, expect } from "vitest"
import { resolve } from "@/lib/resolution/resolve"
import { fromEvmDiagnosis } from "@/lib/resolution/adapt"

/**
 * Every code's custody and retryable field becomes a button on somebody's
 * error screen. The spec says so: an integrator "draws a Retry button because
 * retryable is not 'no'". These pin the three codes whose claims outran their
 * evidence, plus the status that an outage now gets.
 */
const AT = "2026-09-03T01:00:00.000Z"
const H = "0x" + "d".repeat(64)

describe("TXID-1003: a submission timeout is not proof nothing was sent", () => {
  const r = resolve({ hash: H, walletError: "request timeout while sending", observedAt: AT })
  it("is still classified as RPC_UNAVAILABLE", () => expect(r.txid_code).toBe("TXID-1003"))
  it("does not claim custody unchanged", () => expect(r.custody).toBe("unknown"))
  it("does not license a blind resubmit", () => {
    expect(r.retryable).not.toBe("yes")
    expect(r.recommended_action).toBe("REFRESH_AND_RECHECK")
  })
  it("is not reported as never submitted", () => expect(r.status).not.toBe("not_submitted"))
  it("is reported as indeterminate, because that is what we know", () => expect(r.status).toBe("indeterminate"))
})

describe("TXID-3001: nonce too low means an earlier transaction already mined", () => {
  const r = resolve({ hash: H, walletError: "nonce too low", observedAt: AT })
  it("does not claim custody unchanged, matching DUPLICATE_SUBMISSION", () => expect(r.custody).toBe("unknown"))
  it("tells the caller to check before resubmitting", () => expect(r.detail).toMatch(/may have executed/i))
})

describe("TXID-5004: an expired deadline cannot be retried as-is", () => {
  const r = resolve({
    hash: H, onchain: "failure", observedAt: AT,
    revert: { cause: "revert_reason", reason: "UniswapV2Router: EXPIRED" },
  })
  it("classifies the deadline", () => expect(r.txid_code).toBe("TXID-5004"))
  it("requires a change before retrying", () => {
    expect(r.retryable).toBe("after_change")
    expect(r.recommended_action).not.toBe("RETRY_AS_IS")
  })
})

describe("TXID-5009: a replay that succeeds is a condition that changed", () => {
  const input = fromEvmDiagnosis(
    { status: "failed", chainId: "0x38", cause: "state_dependent", explanation: "replay succeeds" },
    H, { observedAt: AT },
  )
  const r = resolve(input)
  it("routes the new decoder cause onto the revert branch", () => expect(input.revert?.cause).toBe("state_dependent"))
  it("classifies it as STATE_CHANGED_IN_BLOCK", () => expect(r.txid_code).toBe("TXID-5009"))
  it("says it reverted and nothing moved, which is true", () => expect(r.custody).toBe("unchanged"))
  it("is retryable, because the condition may have passed", () => expect(r.retryable).toBe("yes"))
})

describe("status: an outage is indeterminate, not failed", () => {
  it("INSUFFICIENT_EVIDENCE is not reported as a failure", () => {
    const r = resolve({ hash: H, observedAt: AT })
    expect(r.txid_code).toBe("TXID-9004")
    expect(r.status).toBe("indeterminate")
  })
  it("TRANSACTION_NOT_FOUND is not reported as a failure", () => {
    const r = resolve({ hash: H, onchain: "not_found", observedAt: AT })
    expect(r.txid_code).toBe("TXID-9003")
    expect(r.status).toBe("indeterminate")
  })
  it("a decoded revert is still a failure", () => {
    const r = resolve({ hash: H, onchain: "failure", observedAt: AT, revert: { cause: "out_of_gas" } })
    expect(r.status).toBe("failed")
  })
  it("a real dropped answer keeps its own status, it is not indeterminate", () => {
    // 3008 sits outside PENDING_CODES and reported "failed" before tonight;
    // whether a never-executed transaction should be "failed" is a separate,
    // pre-existing question for the Status union. This pins only that the
    // indeterminate rule did not swallow it.
    const r = resolve({ hash: H, onchain: "not_found", observedAt: AT, pending: { cause: "dropped" } })
    expect(r.txid_code).toBe("TXID-3008")
    expect(r.status).not.toBe("indeterminate")
  })
})
