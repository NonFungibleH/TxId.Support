import { describe, it, expect } from "vitest"
import type { PendingDiagnosis } from "@txid/blockchain"
import { PENDING_CAUSES, fromEvmDiagnosis } from "@/lib/resolution/adapt"
import { resolve } from "@/lib/resolution/resolve"

/**
 * One pending cause lives in FOUR places, and nothing kept them in step.
 *
 *   packages/blockchain/src/types.ts        the union the probe produces
 *   apps/app/lib/resolution/types.ts        the union the resolver accepts
 *   apps/app/lib/resolution/adapt.ts        PENDING_CAUSES, the routing set
 *   apps/app/lib/resolution/resolve.ts      the classify() switch
 *
 * Add a cause to the first and forget the third, and adapt.ts silently drops
 * it onto the not-found branch: the API answers TXID-9003 "no transaction
 * with this identifier could be found" for a hash the node just described in
 * detail. That is the shape of every bug this week, produced by a refactor
 * rather than a provider.
 *
 * Two guards. EXPECTED is typed against the blockchain union, so adding a
 * cause there without a row here fails `tsc` for whoever inherits this. The
 * runtime loop then checks each cause actually reaches the code it should,
 * through the real adapter and classifier, not a mock.
 */
const EXPECTED = {
  pending_stuck_nonce: "TXID-3006",
  pending_underpriced: "TXID-3003",
  pending_congestion: "TXID-3007",
  dropped: "TXID-3008",
  insufficient_gas_balance: "TXID-2001",
  lookup_failed: "TXID-9004",
} satisfies Record<PendingDiagnosis["cause"], string>

const H = "0x" + "c".repeat(64)
const AT = "2026-09-03T00:00:00.000Z"

describe("every pending cause the probe can produce is routed and classified", () => {
  for (const [cause, code] of Object.entries(EXPECTED)) {
    it(`${cause} → ${code}`, () => {
      expect(PENDING_CAUSES.has(cause), `${cause} is missing from PENDING_CAUSES in adapt.ts`).toBe(true)
      const input = fromEvmDiagnosis({ status: "not_found", chainId: "0x38", cause }, H, { observedAt: AT })
      expect(input.pending?.cause, `${cause} did not land on the pending branch`).toBe(cause)
      expect(resolve(input).txid_code).toBe(code)
    })
  }

  it("the routing set contains nothing the probe cannot produce", () => {
    // A stale entry is harmless today and misleading tomorrow.
    for (const c of PENDING_CAUSES) {
      expect(c in EXPECTED, `${c} is in PENDING_CAUSES but no probe produces it`).toBe(true)
    }
  })

  it("an unrouted cause would fall to not-found, which is why this file exists", () => {
    // Demonstrate the failure mode the guards prevent: a cause absent from the
    // set is not an error, it is a silent TXID-9003.
    const input = fromEvmDiagnosis({ status: "not_found", chainId: "0x38", cause: "some_future_cause" }, H, { observedAt: AT })
    expect(input.pending).toBeUndefined()
    expect(resolve(input).txid_code).toBe("TXID-9003")
  })
})
