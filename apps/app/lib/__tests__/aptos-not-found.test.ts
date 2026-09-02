import { describe, it, expect, vi, afterEach } from "vitest"
import { executeTool } from "@txid/ai"

/**
 * An Aptos-only session has no EVM chains to be unreachable.
 *
 * The EVM fan-out learned to say "lookup_failed" when every candidate chain
 * could not be asked. On an Aptos-only session there are NO EVM candidates,
 * so "none reachable" was trivially true, and a hash the fullnode genuinely
 * does not have was reported as an outage instead of as not found. That is
 * the Decibel demo's exact path, the night before the Decibel demo.
 *
 * Pins: the fullnode answering 404 is a real answer, surfaced as not_found
 * with Aptos-specific causes, with "aptos" listed as checked; and a found
 * transaction still comes back as one.
 */
const HASH = "0x" + "e".repeat(64)
const APTOS_WALLET = "0x" + "1".repeat(64)
const FULLNODE = "https://fullnode.mainnet.aptoslabs.com/v1"

afterEach(() => vi.unstubAllGlobals())

const USER_TX = {
  type: "user_transaction",
  hash: HASH,
  version: "7053000000",
  success: true,
  vm_status: "Executed successfully",
  timestamp: "1788400000000000",
  sender: APTOS_WALLET,
  gas_used: "12",
  gas_unit_price: "100",
  payload: { type: "entry_function_payload", function: "0x1::aptos_account::transfer", type_arguments: [], arguments: [] },
  signature: { type: "ed25519_signature" },
  events: [],
  changes: [],
}

function fullnode(txReply: "404" | "found") {
  return vi.fn(async (url: string | URL) => {
    const u = String(url)
    if (u.startsWith(FULLNODE) && u.includes("/transactions/by_hash/")) {
      if (txReply === "404") return { ok: false, status: 404, json: async () => ({ message: "Transaction not found" }), headers: new Headers() } as unknown as Response
      return { ok: true, status: 200, json: async () => USER_TX, headers: new Headers() } as unknown as Response
    }
    // Anything else (market names, indexer) answers empty rather than failing.
    return { ok: true, status: 200, json: async () => ({}), headers: new Headers() } as unknown as Response
  })
}

describe("get_transaction_by_hash on an Aptos-only session", () => {
  it("a hash the fullnode does not have is not_found, never lookup_failed", async () => {
    vi.stubGlobal("fetch", fullnode("404"))
    const r = (await executeTool(
      "get_transaction_by_hash",
      { tx_hash: HASH, hash: HASH },
      { address: APTOS_WALLET, chainId: "aptos" },
      [],
    )) as Record<string, unknown>
    expect(r.status, "the fullnode answered; that is not an outage").toBe("not_found")
    expect(r.status).not.toBe("lookup_failed")
    expect(r.checkedChains, "Aptos was checked").toContain("aptos")
    expect(r).toHaveProperty("aptosNotFoundCauses")
  })

  it("a transaction the fullnode has still comes back as found", async () => {
    vi.stubGlobal("fetch", fullnode("found"))
    const r = (await executeTool(
      "get_transaction_by_hash",
      { tx_hash: HASH, hash: HASH },
      { address: APTOS_WALLET, chainId: "aptos" },
      [],
    )) as Record<string, unknown>
    expect(r.chainId).toBe("aptos")
    expect(r.status).not.toBe("lookup_failed")
    expect(r.status).not.toBe("not_found")
  })
})
