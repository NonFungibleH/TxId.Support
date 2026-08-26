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
