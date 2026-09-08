import { describe, it, expect, vi, afterEach } from "vitest"
import { explorerRead } from "./blockscout"
import { getContractEvents, getUpgradeHistory } from "./events"

/**
 * "Has this contract been upgraded?" is asked by somebody who thinks the code
 * changed underneath them. An all-clear is the answer that stops them looking,
 * so it must never be produced by a lookup that did not complete.
 *
 * This was live and wrong on EVERY call, not only during an outage: Etherscan
 * V2 answers an unkeyed request with HTTP 200 and status "0", ETHERSCAN_API_KEY
 * is unset in production, and Ethereum has no Blockscout fallback, so
 * getUpgradeHistory returned [] for every contract on mainnet. Verified on
 * 2026-09-08 against USDC, a proxy upgraded several times.
 */

const ETH = "0x1"        // Etherscan only, no Blockscout fallback
const BASE = "0x2105"    // Etherscan + Blockscout
const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response

/** What Etherscan V2 really returns with no key. Captured live. */
const MISSING_KEY = { status: "0", message: "NOTOK", result: "Missing/Invalid API Key" }
const NO_RECORDS = { status: "0", message: "No records found", result: [] }
const RATE_LIMIT = { status: "0", message: "NOTOK", result: "Max rate limit reached" }

const log = (over: Record<string, unknown>) => ({
  topics: ["0xbc7cd75a20ee27fd9adebab32041f755214dbc6bffa90cc0225b39da2e5c2d3b", null, null, null],
  data: "0x",
  timeStamp: "0x657b4a9f",
  transactionHash: "0xc5ac23d495c9fa1d1293ded109525ec865e382527b5bfe62a6970fbbf0418ca7",
  ...over,
})

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
const serve = (body: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn(async () => json(body, status)))

describe("nothing found is not the same as nobody answered", () => {
  it("an unkeyed Etherscan is unavailable, never an empty history", async () => {
    serve(MISSING_KEY)
    const r = await getUpgradeHistory("0xabc", ETH)
    expect(r.status).toBe("unavailable")
    if (r.status === "unavailable") expect(r.reason).toMatch(/Missing\/Invalid API Key/)
  })

  it("a rate limit is unavailable", async () => {
    serve(RATE_LIMIT)
    expect((await getUpgradeHistory("0xabc", ETH)).status).toBe("unavailable")
  })

  it("an unreachable explorer is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up") }))
    expect((await getUpgradeHistory("0xabc", ETH)).status).toBe("unavailable")
  })

  // The distinction the whole change exists for: an explorer that IS working
  // and holds no Upgraded logs has answered the question.
  it("a genuine 'No records found' IS a finding of no upgrades", async () => {
    serve(NO_RECORDS)
    const r = await getUpgradeHistory("0xabc", ETH)
    expect(r.status).toBe("ok")
    if (r.status === "ok") expect(r.upgrades).toEqual([])
  })

  it("explorerRead keeps the three apart", async () => {
    serve(NO_RECORDS);   expect((await explorerRead(ETH, {})).kind).toBe("empty")
    serve(MISSING_KEY);  expect((await explorerRead(ETH, {})).kind).toBe("unavailable")
    serve({ status: "1", message: "OK", result: [] })
    expect((await explorerRead(ETH, {})).kind).toBe("ok")
  })

  // A chain with a Blockscout fallback must not be dragged down by Etherscan
  // failing: a definite answer from either explorer is an answer.
  it("falls through to Blockscout when Etherscan has no key", async () => {
    let n = 0
    vi.stubGlobal("fetch", vi.fn(async () =>
      ++n === 1 ? json(MISSING_KEY) : json({ status: "1", message: "OK", result: [log({ data: "0x000000000000000000000000" + "2ce6311ddae708829bc0784c967b7d77d19fd779" })] })))
    const r = await getUpgradeHistory("0xabc", BASE)
    expect(r.status).toBe("ok")
    if (r.status === "ok") expect(r.upgrades[0]?.implementation).toBe("0x2ce6311ddae708829bc0784c967b7d77d19fd779")
  })
})

describe("the implementation address, wherever the log put it", () => {
  /**
   * `Upgraded(address)` hashes to the same topic0 indexed or not, so the
   * argument may be in topics[1] or in data and the topic cannot tell you
   * which. Reading topics[1] alone rendered the literal "0x" as the new
   * implementation, which reads like a burn address. Observed on USDC on Base.
   */
  it("reads it from data when the parameter is not indexed", async () => {
    serve({ status: "1", result: [log({ data: "0x000000000000000000000000" + "2ce6311ddae708829bc0784c967b7d77d19fd779" })] })
    const r = await getUpgradeHistory("0xabc", ETH)
    if (r.status !== "ok") throw new Error("expected ok")
    expect(r.upgrades[0]?.implementation).toBe("0x2ce6311ddae708829bc0784c967b7d77d19fd779")
    expect(r.upgrades[0]?.implementation).not.toBe("0x")
  })

  it("reads it from topics[1] when it is indexed", async () => {
    serve({ status: "1", result: [log({
      topics: ["0xbc7c", "0x000000000000000000000000" + "43506849d7c04f9138d1a2050bbf3a0c054402dd", null, null],
    })] })
    const r = await getUpgradeHistory("0xabc", ETH)
    if (r.status !== "ok") throw new Error("expected ok")
    expect(r.upgrades[0]?.implementation).toBe("0x43506849d7c04f9138d1a2050bbf3a0c054402dd")
  })

  // The upgrade still happened, so it is still reported. We just cannot name
  // what it pointed at, and null says that where "0x" pretended otherwise.
  it("reports null rather than a malformed address when neither carries one", async () => {
    serve({ status: "1", result: [log({})] })
    const r = await getUpgradeHistory("0xabc", ETH)
    if (r.status !== "ok") throw new Error("expected ok")
    expect(r.upgrades).toHaveLength(1)
    expect(r.upgrades[0]?.implementation).toBeNull()
  })
})

describe("an event log nobody answered is not an event that never fired", () => {
  const ABI = JSON.stringify([{ type: "event", name: "Paused", inputs: [{ type: "address" }] }])

  /**
   * "Has this contract ever been paused?" answered "no, never" during an
   * outage, and on every mainnet call, because the tool arm reported
   * `count: 0, checked: true`. `checked: true` is an explicit claim that we
   * looked.
   */
  it("refuses to report zero Paused events when the explorer declined", async () => {
    serve(MISSING_KEY)
    const r = await getContractEvents("0xabc", ETH, "Paused", ABI)
    expect(r.status).toBe("unavailable")
  })

  it("a working explorer holding no such logs IS a finding", async () => {
    serve(NO_RECORDS)
    const r = await getContractEvents("0xabc", ETH, "Paused", ABI)
    expect(r.status).toBe("ok")
    if (r.status === "ok") expect(r.events).toEqual([])
  })

  it("returns the events when they are there", async () => {
    serve({ status: "1", result: [{ transactionHash: "0xdead", blockNumber: "0x10", timeStamp: "0x657b4a9f" }] })
    const r = await getContractEvents("0xabc", ETH, "Paused", ABI)
    if (r.status !== "ok") throw new Error("expected ok")
    expect(r.events).toHaveLength(1)
    expect(r.events[0]?.event).toBe("Paused")
  })

  // The ABI-free fallback tries several candidate signatures. If ANY of those
  // queries failed, an empty overall result cannot be trusted either.
  it("a failure in the ABI-free fallback still poisons an empty result", async () => {
    serve(RATE_LIMIT)
    const r = await getContractEvents("0xabc", ETH, "Transfer", undefined)
    expect(r.status).toBe("unavailable")
  })
})
