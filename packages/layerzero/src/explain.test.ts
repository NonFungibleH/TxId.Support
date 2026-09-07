import { describe, it, expect } from "vitest"
import { explainLayerZero } from "./explain"
import type { LayerZeroMessage } from "./types"

const msg = (srcStatus: string, dstStatus: string): LayerZeroMessage => ({
  guid: "0x0457d1143ac5bd90",
  app: "Stargate",
  sender: "0x6bf98654205b1ac38645880ae20fc00b0bb9ffca",
  receiver: "0x556f119c7433b2232294fb3de267747745a1dab4",
  source: { chain: "arbitrum", status: srcStatus, txHash: "0x77379e93", blockTimestamp: 1724452531 },
  destination: { chain: "ethereum", status: dstStatus, txHash: null, blockTimestamp: null },
})

describe("explainLayerZero", () => {
  // Every state must refuse a second send. A user whose funds left one chain
  // and have not arrived on the other is one click from bridging twice, and
  // the first transfer is still coming.
  it.each([
    ["SUCCEEDED", "SUCCEEDED"],
    ["SUCCEEDED", "WAITING"],
    ["SUCCEEDED", "VALIDATING_TX"],
    ["VALIDATING_TX", "WAITING"],
    ["SUCCEEDED", "SOME_STATUS_WE_HAVE_NEVER_SEEN"],
    ["SOMETHING_ELSE_ENTIRELY", "WAITING"],
  ])("never says retry: %s -> %s", (s, d) => {
    expect(explainLayerZero(msg(s, d)).retryable).toBe("no")
  })

  it("in flight is partial custody and explicitly not lost", () => {
    const e = explainLayerZero(msg("SUCCEEDED", "WAITING"))
    expect(e.status).toBe("pending")
    expect(e.custody).toBe("partial")
    expect(e.nextActionOwner).toBe("infrastructure")
    expect(e.headline).toMatch(/in transit, not lost/i)
    expect(e.recommendedAction).toMatch(/do not send it again/i)
    expect(e.unrecognised).toBe(false)
  })

  it("delivered is moved, and points at the receiving chain", () => {
    const e = explainLayerZero(msg("SUCCEEDED", "SUCCEEDED"))
    expect(e.status).toBe("succeeded")
    expect(e.custody).toBe("moved")
    expect(e.headline).toMatch(/arrived on ethereum/i)
  })

  it("an unsettled source does not claim the funds moved", () => {
    const e = explainLayerZero(msg("VALIDATING_TX", "WAITING"))
    expect(e.custody).toBe("unknown")
    expect(e.custody).not.toBe("partial")
    expect(e.headline).toMatch(/not been sent across yet/i)
  })

  // The rule this codebase keeps relearning: say what we do not know, rather
  // than inventing a meaning for it.
  it("an unrecognised destination status says so instead of guessing", () => {
    const e = explainLayerZero(msg("SUCCEEDED", "PAYLOAD_STORED"))
    expect(e.unrecognised).toBe(true)
    expect(e.status).toBe("indeterminate")
    expect(e.custody).toBe("partial")
    expect(e.headline).toContain("PAYLOAD_STORED")
    expect(e.headline).toMatch(/cannot interpret/i)
    expect(e.recommendedAction).toContain("0x0457d1143ac5bd90")
  })

  it("names the app and the route when it can, and omits them when it cannot", () => {
    expect(explainLayerZero(msg("SUCCEEDED", "WAITING")).headline).toMatch(/from arbitrum to ethereum via Stargate/)
    const anon = { ...msg("SUCCEEDED", "WAITING"), app: null, source: { chain: null, status: "SUCCEEDED", txHash: null, blockTimestamp: null } }
    const e = explainLayerZero(anon)
    expect(e.headline).not.toMatch(/ via /)
    expect(e.headline).toMatch(/the source chain/)
  })
})
