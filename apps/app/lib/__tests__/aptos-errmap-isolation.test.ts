import { describe, it, expect } from "vitest"
import { errmapFor } from "@txid/aptos"

const DECIBEL = "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06"
const OTHER_APTOS = "0x0000000000000000000000000000000000000000000000000000000000009999"

/**
 * These lock the BLAST RADIUS of the protocol error maps, which is what makes
 * it safe to edit one protocol's wording without reviewing every other tenant.
 * The reasoning was given to a customer as a guarantee, so it is encoded here
 * rather than left as a property of the current implementation.
 */
describe("errmapFor isolation", () => {
  it("gives an EVM-only project nothing at all", () => {
    expect(errmapFor([{ address: "0xdead", chain: "0x1" }])).toEqual({})
  })

  it("gives a project with no watched contracts nothing at all", () => {
    expect(errmapFor([])).toEqual({})
  })

  it("does not leak one protocol's error map to a different Aptos project", () => {
    const map = errmapFor([{ address: OTHER_APTOS, chain: "aptos" }])
    const leaked = Object.keys(map).filter(k => k.toLowerCase().startsWith(DECIBEL))
    expect(leaked).toEqual([])
  })

  it("loads a protocol's error map only for a project that watches its address", () => {
    const map = errmapFor([{ address: DECIBEL, chain: "aptos" }])
    expect(Object.keys(map).some(k => k.toLowerCase().startsWith(DECIBEL))).toBe(true)
  })
})

/**
 * The order-not-found abort proves only that the order was ABSENT from the
 * book. It does not say why. Telling a trader their order filled when it did
 * not is a materially worse error than declining to say, so the reason text
 * must never assert a fill. This shipped once as "likely already filled or
 * cancelled" and is the reason this test exists.
 */
describe("EORDER_NOT_FOUND states only what the abort proves", () => {
  const reasonsFor = (addr: string) =>
    Object.values(errmapFor([{ address: addr, chain: "aptos" }]))
      .flatMap(codes => Object.values(codes))
      .filter(e => e.name === "EORDER_NOT_FOUND")
      .map(e => e.reason)

  it("is present for Decibel", () => {
    expect(reasonsFor(DECIBEL).length).toBeGreaterThan(0)
  })

  it("never claims the order was filled", () => {
    for (const reason of reasonsFor(DECIBEL)) {
      expect(reason).not.toMatch(/already\s+(been\s+)?filled/i)
      expect(reason).not.toMatch(/likely\s+.{0,20}filled/i)
    }
  })

  it("does not send the user off to refresh the app for an answer we hold", () => {
    for (const reason of reasonsFor(DECIBEL)) {
      expect(reason).not.toMatch(/refresh your open orders in the app to see/i)
    }
  })
})
