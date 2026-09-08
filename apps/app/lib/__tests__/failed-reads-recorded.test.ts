import { describe, it, expect, vi, afterEach } from "vitest"
import { executeTool, mergeToolEvidence, toolEvidenceFrom } from "@txid/ai"
import type { WatchedContractSnapshot } from "@txid/ai"

/**
 * Engineering rule 3: every failed read carries `lookupFailed: true` beside its
 * note, and `mergeToolEvidence` reads that marker into the case record's "what
 * did not run". The phrase regex is a LEGACY FALLBACK only.
 *
 * Both halves of that were broken on the Aptos tools, and the reason is worth
 * keeping. The regex only ever inspects a key literally called `note`. These
 * tools report a failure under `error`, or under a scoped name like
 * `holdingsNote` when only part of a result is missing, and none of them set
 * the marker. So a read that failed was invisible to `failedLookups`, to the
 * `read_failed` ticket signal, and to the export an auditor reads, while the
 * model was correctly told not to treat it as an answer. The user got an honest
 * reply and the record of it was wrong.
 *
 * Second, smaller bug in the same place: when the marker WAS set and the
 * sibling key was not `note`, the recorded text was the literal string "lookup
 * failed", so the record said a lookup failed without saying which.
 */
const APTOS_WALLET = "0x" + "2".repeat(64)

afterEach(() => vi.unstubAllGlobals())

/** Every Aptos read fails, which is what an outage actually looks like. */
const aptosDown = () =>
  vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}), headers: new Headers() }) as unknown as Response)

const WALLET = { address: APTOS_WALLET, chainId: "aptos" }
const CONTRACTS: WatchedContractSnapshot[] = [
  { id: "c1", name: "Decibel", address: "0x" + "5".repeat(64), chain: "aptos", description: "perps" },
]

/**
 * What the case record would show for this tool result. `errored: false` because
 * these tools RETURN a failure rather than throwing, which is the whole point:
 * from the loop's side the call succeeded, so only the marker inside the result
 * can say a read did not complete.
 */
function recorded(tool: string, result: unknown): string[] {
  return mergeToolEvidence([toolEvidenceFrom(tool, result, false)]).failedLookups
}

describe("a failed Aptos read reaches the case record", () => {
  it("get_wallet_balance during an outage is recorded as a failed lookup", async () => {
    vi.stubGlobal("fetch", aptosDown())
    const r = (await executeTool("get_wallet_balance", {}, WALLET, CONTRACTS)) as Record<string, unknown>
    expect(r.lookupFailed).toBe(true)
    expect(recorded("get_wallet_balance", r).length).toBeGreaterThan(0)
  })

  it("get_recent_transactions during an outage is recorded as a failed lookup", async () => {
    vi.stubGlobal("fetch", aptosDown())
    const r = (await executeTool("get_recent_transactions", {}, WALLET, CONTRACTS)) as Record<string, unknown>
    expect(r.lookupFailed).toBe(true)
    expect(recorded("get_recent_transactions", r).length).toBeGreaterThan(0)
  })

  it("get_contract_info during an outage is recorded as a failed lookup", async () => {
    vi.stubGlobal("fetch", aptosDown())
    const r = (await executeTool(
      "get_contract_info",
      { contract_address: CONTRACTS[0]!.address },
      WALLET, CONTRACTS,
    )) as Record<string, unknown>
    expect(r.lookupFailed).toBe(true)
    expect(recorded("get_contract_info", r).length).toBeGreaterThan(0)
  })
})

describe("the record says WHICH read failed, not just that one did", () => {
  // The failure text lives under `error` here, not `note`, which is exactly the
  // shape that used to record the placeholder.
  it("reads the sentence out of `error`", () => {
    const out = recorded("get_wallet_balance", {
      lookupFailed: true,
      error: "Could not reach the Aptos indexer to check this right now.",
    })
    expect(out[0]).toContain("Aptos indexer")
    expect(out[0]).not.toBe("lookup failed")
  })

  // A partial result: the balance read worked and the holdings read did not, so
  // the failure is reported under its own scoped key.
  it("reads the sentence out of a scoped `somethingNote`", () => {
    const out = recorded("get_wallet_balance", {
      sui: "12.5 SUI",
      lookupFailed: true,
      holdingsNote: "Could not reach the Aptos fullnode to read this wallet's holdings.",
    })
    expect(out[0]).toContain("holdings")
  })

  it("prefers `note` when a tool provides one", () => {
    const out = recorded("get_wallet_balance", {
      lookupFailed: true,
      note: "the note",
      error: "the error",
    })
    expect(out[0]).toBe("the note")
  })

  it("falls back to a placeholder only when there is genuinely no text", () => {
    expect(recorded("x", { lookupFailed: true })).toEqual(["lookup failed"])
  })
})

describe("a successful read is still not recorded as a failure", () => {
  it("records nothing when nothing failed", () => {
    expect(recorded("get_wallet_balance", { address: APTOS_WALLET, sui: "1.0" })).toEqual([])
  })
})
