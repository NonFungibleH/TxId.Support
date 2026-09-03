import { describe, it, expect, vi, afterEach } from "vitest"
import { decodeTxRevert } from "./decoder"

/**
 * A replay that SUCCEEDS is not a contract that was silent.
 *
 * fetchRevertHex returned the same {ran: true, hex: null} for two opposite
 * outcomes: the contract reverted with no data, and the replayed call did not
 * revert at all. The decoder then said "the smart contract reverted but did
 * not return a specific error message", and the prompt told the model the
 * replay ran, the contract was silent, and it was fair to reason about a
 * likely cause.
 *
 * A transaction that failed on-chain and succeeds on replay is the signature
 * of state that changed inside its block: a trade moving the price past the
 * slippage limit, a competing transaction taking the liquidity. On an
 * exchange that is the commonest failure there is. It now has its own cause,
 * and the replay runs against the state at the start of the block.
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
const reply = (body: unknown) =>
  vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => body } as unknown as Response)

afterEach(() => vi.unstubAllGlobals())

describe("a replay that succeeds is a finding of its own", () => {
  it("a clean RESULT is state_dependent, not a silent revert", async () => {
    vi.stubGlobal("fetch", reply({ jsonrpc: "2.0", id: 1, result: "0x" }))
    const d = await decodeTxRevert(base)
    expect(d.cause).toBe("state_dependent")
    expect(d.reason).toMatch(/succeeds/i)
    expect(d.reason).toMatch(/same block/i)
    expect(d.replayUnavailable).toBeUndefined()
  })

  it("an ERROR with no data is still the contract being silent", async () => {
    vi.stubGlobal("fetch", reply({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "execution reverted" } }))
    const d = await decodeTxRevert(base)
    expect(d.cause).toBe("unknown_revert")
    expect(d.reason).toMatch(/did not return a specific error message/i)
    expect(d.replayUnavailable).toBeUndefined()
  })

  it("an error WITH data is decoded exactly as before", async () => {
    // Error(string) "ERC20: insufficient allowance"
    const data =
      "0x08c379a0" +
      "0000000000000000000000000000000000000000000000000000000000000020" +
      "000000000000000000000000000000000000000000000000000000000000001d" +
      "45524332303a20696e73756666696369656e7420616c6c6f77616e6365000000"
    vi.stubGlobal("fetch", reply({ jsonrpc: "2.0", id: 1, error: { code: 3, message: "execution reverted", data } }))
    const d = await decodeTxRevert(base)
    expect(d.cause).toBe("revert_reason")
    expect(d.reason).toBe("ERC20: insufficient allowance")
  })

  it("a node that cannot replay is still replayUnavailable, untouched", async () => {
    vi.stubGlobal("fetch", reply({ error: { message: "missing trie node" } }))
    const d = await decodeTxRevert(base)
    expect(d.cause).toBe("unknown_revert")
    expect(d.replayUnavailable).toBe(true)
  })

  it("replays against the block BEFORE the transaction's, not its own", async () => {
    const fetchMock = reply({ jsonrpc: "2.0", id: 1, result: "0x" })
    vi.stubGlobal("fetch", fetchMock)
    await decodeTxRevert(base)
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]?.body)) as { params: unknown[] }
    // 118255001 - 1 = 118255000 = 0x70c8d18
    expect(body.params[1]).toBe("0x" + (118255000).toString(16))
  })

  it("never replays at a negative block", async () => {
    const fetchMock = reply({ jsonrpc: "2.0", id: 1, result: "0x" })
    vi.stubGlobal("fetch", fetchMock)
    await decodeTxRevert({ ...base, blockNumber: "0" })
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]?.body)) as { params: unknown[] }
    expect(body.params[1]).toBe("0x0")
  })
})
