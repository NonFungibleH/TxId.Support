import { describe, it, expect, vi, afterEach } from "vitest"
import { SolanaLookupUnavailableError } from "./lookup"
import { getSolanaRecentTransactions } from "./dispatch"

/**
 * The dispatch chooses between two paths that do not enforce the same rule.
 *
 * `rpc.ts` will not report an empty history until a node that keeps the ledger
 * agrees it is empty, because a pruning node answers 200 with `[]` for history
 * it simply does not hold. Helius's enriched endpoint has no equivalent check
 * anywhere: whatever array comes back is mapped and returned.
 *
 * So setting a key silently swapped a guarded path for an unguarded one, and
 * the better-resourced deployment got the weaker answer.
 */

let seq = 0
const nextEndpoint = () => `https://node-${++seq}.test`
const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response
const rpcOk = (result: unknown) => json({ jsonrpc: "2.0", id: 1, result })

const RAW_TX = {
  slot: 1, blockTime: 1757000000,
  transaction: { signatures: ["sig-1"], message: { accountKeys: [], instructions: [] } },
  meta: { err: null, fee: 5000, preBalances: [], postBalances: [], logMessages: [] },
}

/** Helius by hostname, the JSON-RPC nodes by URL and method. */
function world(opts: {
  helius: () => Response
  rpc?: Record<string, Record<string, () => Response>>
}) {
  return vi.fn(async (url: string, init?: { body?: string; method?: string }) => {
    if (url.includes("helius")) return opts.helius()
    const handlers = opts.rpc?.[url]
    if (!handlers) throw new Error(`unexpected url ${url}`)
    const method = JSON.parse(init?.body ?? "{}").method as string
    const h = handlers[method]
    if (!h) throw new Error(`unexpected method ${method} on ${url}`)
    return h()
  })
}

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

describe("an empty history from the enriched Helius endpoint", () => {
  it("is not reported as no transactions when an archival node has them", async () => {
    const archival = nextEndpoint()
    vi.stubEnv("HELIUS_API_KEY", "test-key")
    vi.stubEnv("SOLANA_RPC_URLS", archival)
    vi.stubGlobal("fetch", world({
      helius: () => json([]),
      rpc: {
        [archival]: {
          getFirstAvailableBlock: () => rpcOk(0),
          getSignaturesForAddress: () => rpcOk([{ signature: "sig-1" }]),
          getTransaction: () => rpcOk(RAW_TX),
        },
      },
    }))

    const txs = await getSolanaRecentTransactions("wallet", undefined, 5)
    expect(txs).toHaveLength(1)
  })

  it("is the answer once an archival node agrees", async () => {
    const archival = nextEndpoint()
    vi.stubEnv("HELIUS_API_KEY", "test-key")
    vi.stubEnv("SOLANA_RPC_URLS", archival)
    vi.stubGlobal("fetch", world({
      helius: () => json([]),
      rpc: {
        [archival]: {
          getFirstAvailableBlock: () => rpcOk(0),
          getSignaturesForAddress: () => rpcOk([]),
        },
      },
    }))

    await expect(getSolanaRecentTransactions("wallet", undefined, 5)).resolves.toEqual([])
  })

  it("is unavailable when nothing can confirm it", async () => {
    const dead = nextEndpoint()
    vi.stubEnv("HELIUS_API_KEY", "test-key")
    vi.stubEnv("SOLANA_RPC_URLS", dead)
    vi.stubGlobal("fetch", world({
      helius: () => json([]),
      rpc: { [dead]: { getFirstAvailableBlock: () => json({}, 503), getSignaturesForAddress: () => json({}, 503) } },
    }))

    await expect(getSolanaRecentTransactions("wallet", undefined, 5))
      .rejects.toBeInstanceOf(SolanaLookupUnavailableError)
  })
})

describe("the dispatch's existing decisions", () => {
  it("does not second-guess a Helius answer that has content", async () => {
    // The check costs a round trip, so it belongs only where the answer is the
    // one that cannot be told apart from a failure.
    const rpcUrl = nextEndpoint()
    vi.stubEnv("HELIUS_API_KEY", "test-key")
    vi.stubEnv("SOLANA_RPC_URLS", rpcUrl)
    const fetchMock = world({
      helius: () => json([{ signature: "sig-1", timestamp: 1757000000, slot: 1, fee: 5000, feePayer: "x", type: "TRANSFER", source: "SYSTEM_PROGRAM", description: "sent", instructions: [] }]),
    })
    vi.stubGlobal("fetch", fetchMock)

    const txs = await getSolanaRecentTransactions("wallet", undefined, 5)
    expect(txs).toHaveLength(1)
    expect(fetchMock.mock.calls.map(c => c[0])).not.toContain(rpcUrl)
  })

  it("still refuses to re-serve a Helius OUTAGE from the RPC path", async () => {
    // Deliberate and unchanged: an outage answered from a different source with
    // different fields teaches a caller to read a missing description as a fact
    // about the transaction. An empty list is a different problem, because it
    // is a claim rather than an absence of one.
    const rpcUrl = nextEndpoint()
    vi.stubEnv("HELIUS_API_KEY", "test-key")
    vi.stubEnv("SOLANA_RPC_URLS", rpcUrl)
    const fetchMock = world({ helius: () => json({}, 500) })
    vi.stubGlobal("fetch", fetchMock)

    await expect(getSolanaRecentTransactions("wallet", undefined, 5)).rejects.toThrow()
    expect(fetchMock.mock.calls.map(c => c[0])).not.toContain(rpcUrl)
  })
})
