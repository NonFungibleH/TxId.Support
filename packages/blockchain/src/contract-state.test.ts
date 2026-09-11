import { describe, it, expect, vi, afterEach } from "vitest"
import { readContractState } from "./read"

/**
 * `getContractState` returned null for five different things: the ABI has no
 * such getter, no RPC is configured for the chain, the ABI could not be
 * parsed, the node returned nothing, and any thrown error. The caller in
 * tools.ts then said
 *
 *   "That value is not a readable no-argument getter on this contract, or the
 *    read failed."
 *
 * The "or" is the whole problem. A model handed that sentence has to pick, and
 * the reading it is most likely to give a user is the first one, which is a
 * claim about the CONTRACT built from an outage.
 *
 * Only one of the five is a finding: the ABI was read and does not define a
 * no-argument view getter by that name.
 */
const ABI = JSON.stringify([
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
])
const ETH = "0x1"
const ADDR = "0x0000000000000000000000000000000000000002"
const rpc = (result: unknown) => vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ jsonrpc: "2.0", id: 1, result }) }) as unknown as Response)
afterEach(() => vi.unstubAllGlobals())

describe("reading a no-argument getter", () => {
  it("returns the value when the node answers", async () => {
    vi.stubGlobal("fetch", rpc("0x" + (6).toString(16).padStart(64, "0")))
    const r = await readContractState(ADDR, ETH, "decimals", ABI)
    expect(r.kind).toBe("ok")
    if (r.kind !== "ok") throw new Error("narrowing")
    expect(r.state.value).toBe("6")
  })

  it("says NOT A GETTER when the ABI was read and has no such getter", async () => {
    // The one real finding in the set, and it must stay one.
    vi.stubGlobal("fetch", rpc("0x"))
    const r = await readContractState(ADDR, ETH, "totalSupply", ABI)
    expect(r.kind).toBe("not_a_getter")
  })

  it("does not call a node outage 'not a getter'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED") }))
    const r = await readContractState(ADDR, ETH, "decimals", ABI)
    expect(r.kind).toBe("unavailable")
  })

  it("does not call an empty node reply 'not a getter'", async () => {
    // A getter that IS in the ABI, answered with nothing. The ABI says it
    // exists, so the absence came from the call, not from the contract.
    vi.stubGlobal("fetch", rpc("0x"))
    const r = await readContractState(ADDR, ETH, "decimals", ABI)
    expect(r.kind).toBe("unavailable")
  })

  it("does not call a missing chain config 'not a getter'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("nothing should be fetched") }))
    const r = await readContractState(ADDR, "0xdeadbeef", "decimals", ABI)
    expect(r.kind).toBe("unavailable")
  })

  it("does not call an unreadable ABI 'not a getter'", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("nothing should be fetched") }))
    const noAbi = await readContractState(ADDR, ETH, "decimals", undefined)
    expect(noAbi.kind).toBe("unavailable")
    const badAbi = await readContractState(ADDR, ETH, "decimals", "{not json")
    expect(badAbi.kind).toBe("unavailable")
  })
})
