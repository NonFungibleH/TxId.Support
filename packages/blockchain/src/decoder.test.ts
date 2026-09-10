import { describe, it, expect, vi, afterEach } from "vitest"
import { decodeTxRevert } from "./decoder"

/**
 * The distinction these lock down produced a real wrong answer: a PancakeSwap
 * swap whose reason WAS readable was reported as "reverted silently", because a
 * node refusing the replay looked identical to a contract returning no reason.
 * An answer built on that is fluent, structured and false.
 */
const base = {
  from: "0x044696f82fdcba0996ed696dff0a318e9c81e633",
  to: "0x10ED43C718714eb63d5aA57B78B54704E256024E",
  value: "0",
  input: "0x38ed1739",
  blockNumber: "118255001",
  chainId: "0x38",
  gasUsed: "40096",
  gasLimit: "300000",
}
const reply = (body: unknown, ok = true, status = 200) =>
  vi.fn().mockResolvedValue({ ok, status, json: async () => body } as unknown as Response)

afterEach(() => vi.unstubAllGlobals())

describe("a replay that could not run is not a silent contract", () => {
  it("marks an archive refusal as unreadable, not as a silent revert", async () => {
    vi.stubGlobal("fetch", reply({ error: { message: "Archive requests require a personal token." } }))
    const d = await decodeTxRevert(base)
    expect(d.replayUnavailable).toBe(true)
    expect(d.reason).toMatch(/could not be READ/i)
    expect(d.reason).not.toMatch(/did not return a specific error/i)
  })

  it("treats a missing trie node the same way", async () => {
    vi.stubGlobal("fetch", reply({ error: { message: "missing trie node abc123" } }))
    expect((await decodeTxRevert(base)).replayUnavailable).toBe(true)
  })

  it("treats a network throw the same way", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("socket hang up")))
    expect((await decodeTxRevert(base)).replayUnavailable).toBe(true)
  })

  it("does NOT set the flag when the contract genuinely returned no reason", async () => {
    vi.stubGlobal("fetch", reply({ error: { message: "execution reverted" } }))
    const d = await decodeTxRevert(base)
    expect(d.replayUnavailable).toBeUndefined()
    expect(d.reason).toMatch(/did not return a specific error/i)
  })

  it("still decodes a real Error(string) reason", async () => {
    // abi.encodeWithSignature("Error(string)", "TransferHelper: TRANSFER_FROM_FAILED")
    const msg = "TransferHelper: TRANSFER_FROM_FAILED"
    const hexMsg = Buffer.from(msg, "utf8").toString("hex").padEnd(128, "0")
    const data =
      "0x08c379a0" +
      "0000000000000000000000000000000000000000000000000000000000000020" +
      msg.length.toString(16).padStart(64, "0") +
      hexMsg
    vi.stubGlobal("fetch", reply({ error: { data, message: "execution reverted" } }))
    const d = await decodeTxRevert(base)
    expect(d.cause).toBe("revert_reason")
    expect(d.reason).toContain("TRANSFER_FROM_FAILED")
    expect(d.replayUnavailable).toBeUndefined()
  })
})

// ── A verified contract's own ABI names errors 4byte has never seen ─────────

/**
 * Found on Avalanche, 2026-09-10, sampling live failures.
 *
 * Trader Joe's DLMMRouter reverted with 0xd0a4f13b. That selector is not in
 * 4byte.directory, so the decoder returned "unrecognized error" while holding
 * the router's verified ABI, which names it
 * LBRouter__WrongNativeLiquidityParameters. The ABI was fetched, parsed, and
 * then used only to REFINE a 4byte hit: with no hit to refine, it was dropped.
 *
 * 4byte is a public registry someone has to remember to populate. A verified
 * contract's own ABI is the authority on its own errors, and it was already in
 * hand.
 */
const customBase = {
  from: "0x572abd6461bed2258615e6b99c585ab7c5d05037",
  to: "0xff2befc4ff86cb0f3e8d3d9d6200b7a05bf5d93d",
  value: "0",
  input: "0x8efc2b2c",
  blockNumber: "94946600",
  chainId: "0xa86a",
  gasUsed: "40096",
  gasLimit: "300000",
}
const LB_ABI = JSON.stringify([
  { type: "error", name: "LBRouter__WrongNativeLiquidityParameters", inputs: [
    { type: "address" }, { type: "address" }, { type: "uint256" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "error", name: "LBRouter__AmountSlippageCaught", inputs: [{ type: "uint256" }, { type: "uint256" }] },
])
/** Routes the replay, 4byte and explorer calls a single decode makes. */
function routed(opts: { revert: string; fourByte?: string[]; abi?: string | "unreachable" }) {
  return vi.fn(async (url: string) => {
    const u = String(url)
    if (u.includes("4byte")) {
      return { ok: true, status: 200, json: async () => ({ results: (opts.fourByte ?? []).map(t => ({ text_signature: t })) }) } as unknown as Response
    }
    if (u.includes("etherscan") || u.includes("routescan") || u.includes("blockscout")) {
      if (opts.abi === "unreachable") throw new Error("explorer unreachable")
      return { ok: true, status: 200, json: async () => ({ status: opts.abi ? "1" : "0", result: opts.abi ?? "Contract source code not verified" }) } as unknown as Response
    }
    return { ok: true, status: 200, json: async () => ({ error: { message: "execution reverted", data: opts.revert } }) } as unknown as Response
  })
}

describe("a custom error the contract's ABI names but 4byte does not", () => {
  it("is resolved from the ABI instead of being called unrecognized", async () => {
    vi.stubGlobal("fetch", routed({ revert: "0xd0a4f13b", fourByte: [] }))
    const d = await decodeTxRevert({ ...customBase, preloadedAbi: LB_ABI })
    expect(d.cause).toBe("custom_error")
    expect(d.errorName).toBe("LBRouter__WrongNativeLiquidityParameters")
    expect(d.reason).not.toMatch(/unrecognized/i)
  })

  it("carries the full signature, so the argument types are readable", async () => {
    vi.stubGlobal("fetch", routed({ revert: "0xd0a4f13b", fourByte: [] }))
    const d = await decodeTxRevert({ ...customBase, preloadedAbi: LB_ABI })
    expect(d.errorSignature).toBe("LBRouter__WrongNativeLiquidityParameters(address,address,uint256,uint256,uint256)")
  })

  it("prefers the contract's own ABI over a conflicting 4byte answer", async () => {
    // 4byte is world-writable: anyone may register any text against a selector.
    // The verified contract is the authority on what its own selector means.
    vi.stubGlobal("fetch", routed({ revert: "0xd0a4f13b", fourByte: ["definitelyNotThis()"] }))
    const d = await decodeTxRevert({ ...customBase, preloadedAbi: LB_ABI })
    expect(d.errorName).toBe("LBRouter__WrongNativeLiquidityParameters")
  })

  it("still falls back to 4byte when the ABI does not define the selector", async () => {
    vi.stubGlobal("fetch", routed({ revert: "0x969bf728", fourByte: ["NothingToClaim()"] }))
    const d = await decodeTxRevert({ ...customBase, preloadedAbi: LB_ABI })
    expect(d.cause).toBe("custom_error")
    expect(d.errorSignature).toBe("NothingToClaim()")
  })

  it("does not call an error unrecognized when the ABI could not be read", async () => {
    // Absence of a lookup is not absence of a definition. Saying "unrecognized"
    // claims we checked the contract, and we did not.
    vi.stubGlobal("fetch", routed({ revert: "0x53b33c9f", fourByte: [], abi: "unreachable" }))
    const d = await decodeTxRevert({ ...customBase })
    expect(d.reason).not.toMatch(/unrecognized/i)
    expect(d.reason).toMatch(/could not|unavailable|unable/i)
  })
})
