import { describe, it, expect, vi, afterEach } from "vitest"
import { SolanaLookupUnavailableError } from "./lookup"
import {
  getSolanaRecentTransactionsRpc,
  getSolanaTransactionBySignatureRpc,
  getSolanaWalletBalanceRpc,
  solanaRetention,
} from "./rpc"

/**
 * Solana without a Helius key.
 *
 * Every payload shape below was taken from live mainnet on 2026-09-08, and the
 * retention numbers in "a node that prunes" are measured, not illustrative.
 */

let seq = 0
/** A fresh endpoint per test: the archival cache is keyed by URL and is meant to persist. */
const nextEndpoint = () => `https://node-${++seq}.test`
const json = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as unknown as Response
const rpcOk = (result: unknown) => json({ jsonrpc: "2.0", id: 1, result })
const rpcErr = (message: string) => json({ jsonrpc: "2.0", id: 1, error: { code: -32602, message } })

/**
 * Routes by JSON-RPC method so a test states only what it cares about, and by
 * URL so it states only which NODE it cares about.
 *
 * The URL check is load-bearing rather than tidiness. Retention is cached at
 * module level on purpose, so a mock that answers for every host writes an
 * answer for hosts the test never mentioned, and the next test inherits it.
 * Refusing an unknown host makes the probe throw, which `isArchival` treats as
 * unknown and does not cache.
 */
function nodeReturning(url: string, handlers: Record<string, () => Response>) {
  return vi.fn(async (asked: string, init?: { body?: string }) => {
    if (asked !== url) throw new Error(`unexpected url ${asked}`)
    const method = JSON.parse(init?.body ?? "{}").method as string
    const h = handlers[method]
    if (!h) throw new Error(`unexpected method ${method}`)
    return h()
  })
}

const ARCHIVAL = () => rpcOk(0)
/** publicnode's real value against a current slot of 445,356,904: ~3 days. */
const PRUNING = () => rpcOk(444703101)

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })

const useNode = (handlers: Record<string, () => Response>) => {
  const url = nextEndpoint()
  vi.stubEnv("SOLANA_RPC_URLS", url)
  vi.stubGlobal("fetch", nodeReturning(url, handlers))
}

// ── The finding that shaped the file ────────────────────────────────────────

describe("an empty history from a node that prunes", () => {
  const emptyHistory = {
    getSignaturesForAddress: () => rpcOk([]),
  }

  /**
   * Measured live: solana-rpc.publicnode.com returned an EMPTY LIST, HTTP 200,
   * no error, for a wallet whose last activity was 25 days ago, because it
   * keeps roughly three days of ledger. api.mainnet-beta.solana.com returned
   * that wallet's five real signatures. On a pruning node "this wallet has no
   * transactions" and "my ledger does not go back that far" are the same
   * response, and the user it reaches is the one who came back after a month
   * to ask where their money went.
   */
  it("is refused, because it cannot be told from a wallet with no history", async () => {
    useNode({ ...emptyHistory, getFirstAvailableBlock: PRUNING })
    await expect(getSolanaRecentTransactionsRpc("addr")).rejects.toBeInstanceOf(SolanaLookupUnavailableError)
    await expect(getSolanaRecentTransactionsRpc("addr")).rejects.toThrow(/keeps only recent history/)
  })

  it("is a real answer from an archival node", async () => {
    useNode({ ...emptyHistory, getFirstAvailableBlock: ARCHIVAL })
    await expect(getSolanaRecentTransactionsRpc("addr")).resolves.toEqual([])
  })
})

// ── Reads that did not complete ─────────────────────────────────────────────

describe("a node that does not answer is never an empty wallet", () => {
  it("treats a JSON-RPC error object as declining, not as zero", async () => {
    useNode({ getBalance: () => rpcErr("Request blocked") })
    await expect(getSolanaWalletBalanceRpc("addr")).rejects.toBeInstanceOf(SolanaLookupUnavailableError)
  })

  it("treats an HTTP failure as unavailable", async () => {
    useNode({ getSignaturesForAddress: () => json({}, 503) })
    await expect(getSolanaRecentTransactionsRpc("addr")).rejects.toBeInstanceOf(SolanaLookupUnavailableError)
  })

  it("refuses a partial history rather than returning a short list", async () => {
    // Signatures come back, but no transaction hydrates. An empty array here
    // would read as an inactive wallet. Same bug as Aptos's hydrateVersions.
    useNode({
      getSignaturesForAddress: () => rpcOk([{ signature: "a" }, { signature: "b" }]),
      getTransaction: () => json({}, 429),
      getFirstAvailableBlock: ARCHIVAL,
    })
    await expect(getSolanaRecentTransactionsRpc("addr")).rejects.toThrow(/no transaction details/)
  })

  // Token-2022 is a separate program, so asking only the original one under-
  // reports a wallet holding 2022 mints. A partial holdings list presented as
  // complete is a finding produced by a failure.
  it("fails rather than under-report when only one token program answers", async () => {
    let call = 0
    vi.stubEnv("SOLANA_RPC_URLS", nextEndpoint())
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: { body?: string }) => {
      const m = JSON.parse(init?.body ?? "{}").method
      if (m === "getBalance") return rpcOk({ value: 1e9 })
      if (m === "getTokenAccountsByOwner") return ++call === 1 ? rpcOk({ value: [] }) : json({}, 500)
      throw new Error(m)
    }))
    await expect(getSolanaWalletBalanceRpc("addr")).rejects.toBeInstanceOf(SolanaLookupUnavailableError)
  })
})

// ── Shape of what it returns ────────────────────────────────────────────────

/** A real mainnet failure: ojh19… rejected instruction 3 with Custom 5457. */
const FAILED_TX = {
  slot: 445357010,
  blockTime: Math.floor(Date.now() / 1000) - 5400,
  meta: {
    err: { InstructionError: [3, { Custom: 5457 }] },
    fee: 5049,
    logMessages: [
      "Program ojh19ojaKduoJZuaJADhcVGp4xt1TcdAvZmpVsCorch invoke [1]",
      "Program ojh19ojaKduoJZuaJADhcVGp4xt1TcdAvZmpVsCorch failed: custom program error: 0x1551",
    ],
    preBalances: [10_000_000, 500], postBalances: [9_994_951, 500],
    preTokenBalances: [], postTokenBalances: [],
    innerInstructions: [],
  },
  transaction: {
    signatures: ["vjYLBDzkYtPQnkn6RQBgVC9yyatY29ZZzQSEUY8t3ucFjnbpoM4qesdWAXVRgDXRQsbANC8j1Ji7YDNxkHKgBrK"],
    message: {
      accountKeys: [{ pubkey: "83TSSS7qojPowqrrvH23mCrhEJjnJG2ygaf7FEq9ZgKC" }, { pubkey: "SysvarC1ock11111111111111111111111111111111" }],
      instructions: [
        { programId: "ComputeBudget111111111111111111111111111111" },
        { programId: "ComputeBudget111111111111111111111111111111" },
        { programId: "ComputeBudget111111111111111111111111111111" },
        { programId: "ojh19ojaKduoJZuaJADhcVGp4xt1TcdAvZmpVsCorch" },
      ],
    },
  },
}

describe("a failed transaction read straight from a node", () => {
  it("names the failing program from the logs and takes the honest floor on the code", async () => {
    useNode({ getTransaction: () => rpcOk(FAILED_TX) })
    const tx = await getSolanaTransactionBySignatureRpc("sig")
    expect(tx?.status).toBe("failed")
    expect(tx?.decodedError?.program).toBe("ojh19ojaKduoJZuaJADhcVGp4xt1TcdAvZmpVsCorch")
    expect(tx?.decodedError?.code).toBe(5457)
    // 5457 is in the program's OWN error space and it publishes nothing, so a
    // name must not be invented.
    expect(tx?.decodedError?.errorName).toBeNull()
    expect(tx?.decodedError?.unrecognised).toBe(true)
  })

  /**
   * `InstructionError` carries an INDEX into the ORDERED instruction list, and
   * three ComputeBudget instructions sit ahead of the real one here. Deduping
   * before indexing blames the wrong program, and on this transaction it would
   * name ComputeBudget.
   */
  it("does not let deduping shift the blame to the wrong program", async () => {
    useNode({ getTransaction: () => rpcOk({ ...FAILED_TX, meta: { ...FAILED_TX.meta, logMessages: [] } }) })
    const tx = await getSolanaTransactionBySignatureRpc("sig")
    expect(tx?.decodedError?.program).toBe("ojh19ojaKduoJZuaJADhcVGp4xt1TcdAvZmpVsCorch")
    expect(tx?.decodedError?.program).not.toBe("ComputeBudget111111111111111111111111111111")
    // The deduped list is still what callers see.
    expect(tx?.programIds).toEqual([
      "ComputeBudget111111111111111111111111111111",
      "ojh19ojaKduoJZuaJADhcVGp4xt1TcdAvZmpVsCorch",
    ])
  })

  /**
   * Helius writes `description` and `type` itself; no node produces them. A
   * plausible sentence assembled from the instruction list is the field a user
   * is most likely to quote back, so it stays null.
   */
  it("leaves the enriched fields null rather than inventing them", async () => {
    useNode({ getTransaction: () => rpcOk(FAILED_TX) })
    const tx = await getSolanaTransactionBySignatureRpc("sig")
    expect(tx?.description).toBeNull()
    expect(tx?.type).toBeNull()
  })

  // Solana's blockTime is SECONDS. Passing it as milliseconds renders 1970,
  // and hours must be spelled out beside minutes (the observed #77 failure).
  it("reads blockTime as seconds", async () => {
    useNode({ getTransaction: () => rpcOk(FAILED_TX) })
    const tx = await getSolanaTransactionBySignatureRpc("sig")
    expect(tx?.age).toMatch(/hour/)
    expect(tx?.age).not.toMatch(/year|1970/)
  })

  it("reports the fee paid, and does not count it as a transfer", async () => {
    useNode({ getTransaction: () => rpcOk(FAILED_TX) })
    const tx = await getSolanaTransactionBySignatureRpc("sig")
    expect(tx?.fee).toBe(5049)
    // The only native delta is the fee, which is not somebody paying somebody.
    expect(tx?.nativeTransfers).toEqual([])
  })
})

describe("balances", () => {
  it("reads SOL and skips zero-balance token accounts", async () => {
    const acct = (mint: string, amount: string) => ({
      account: { data: { parsed: { info: { mint, tokenAmount: { amount, decimals: 6, uiAmountString: "1.5" } } } } },
    })
    useNode({
      getBalance: () => rpcOk({ value: 2_500_000_000 }),
      getTokenAccountsByOwner: () => rpcOk({ value: [acct("MintA", "1500000"), acct("MintB", "0")] }),
    })
    const b = await getSolanaWalletBalanceRpc("addr")
    expect(b.solRaw).toBe(2_500_000_000)
    expect(b.sol).toBe("2.5")
    expect(b.tokens.map(t => t.mint)).toEqual(["MintA", "MintA"])
  })
})

// ── Retention as a diagnostic, not just a gate ──────────────────────────────

/**
 * `isArchival` answers a yes/no question and deliberately fails CLOSED: a node
 * that prunes and a node that cannot be reached both return false, because for
 * the guard they mean the same thing, which is "an empty list is not an answer".
 *
 * For an operator reading the admin console they mean opposite things. One says
 * the plan is wrong, the other says the URL or the key is wrong, and those have
 * no fix in common. So the diagnostic is a THIRD state rather than a second
 * caller of the boolean.
 */
describe("solanaRetention", () => {
  it("reports archival when the node keeps the full ledger", async () => {
    useNode({ getFirstAvailableBlock: ARCHIVAL })
    const r = await solanaRetention()
    expect(r.kind).toBe("archival")
  })

  it("reports pruning WITH the block, so the gap is visible", async () => {
    useNode({ getFirstAvailableBlock: PRUNING })
    const r = await solanaRetention()
    expect(r.kind).toBe("pruning")
    if (r.kind !== "pruning") throw new Error("narrowing")
    expect(r.firstAvailableBlock).toBe(444703101)
  })

  it("separates a node that cannot be reached from one that prunes", async () => {
    vi.stubEnv("SOLANA_RPC_URLS", nextEndpoint())
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ECONNREFUSED") }))
    const r = await solanaRetention()
    expect(r.kind).toBe("unavailable")
  })

  it("treats a rejected key as unavailable, never as pruning", async () => {
    // The failure mode for a keyed provider URL that is wrong or out of credit.
    // Calling that "pruning" would send the operator to upgrade a plan that is
    // not the problem.
    vi.stubEnv("SOLANA_RPC_URLS", nextEndpoint())
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "unauthorized" }, 401)))
    const r = await solanaRetention()
    expect(r.kind).toBe("unavailable")
    if (r.kind !== "unavailable") throw new Error("narrowing")
    expect(r.reason).toContain("401")
  })
})

// ── Recovering from a pruning endpoint instead of only reporting it ─────────

/** Routes by URL first, then by method, so a test can give two nodes different ledgers. */
function nodesReturning(byUrl: Record<string, Record<string, () => Response>>) {
  return vi.fn(async (url: string, init?: { body?: string }) => {
    const method = JSON.parse(init?.body ?? "{}").method as string
    const handlers = byUrl[url]
    if (!handlers) throw new Error(`unexpected url ${url}`)
    const h = handlers[method]
    if (!h) throw new Error(`unexpected method ${method} on ${url}`)
    return h()
  })
}

describe("an empty list from a pruning endpoint", () => {
  const SIGS = [{ signature: "sig-1" }]
  const RAW_TX = {
    slot: 1, blockTime: 1757000000, transaction: { signatures: ["sig-1"], message: { accountKeys: [], instructions: [] } },
    meta: { err: null, fee: 5000, preBalances: [], postBalances: [], logMessages: [] },
  }

  it("is retried against an archival endpoint rather than reported as unavailable", async () => {
    // The measured case in miniature: the fast provider prunes and answers 200
    // with nothing, the archival node holds the wallet's real history. Only the
    // second answer is a finding, and today it is never asked for.
    const pruning = nextEndpoint()
    const archival = nextEndpoint()
    vi.stubEnv("SOLANA_RPC_URLS", `${pruning},${archival}`)
    vi.stubGlobal("fetch", nodesReturning({
      // getTransaction is registered ONLY on the archival node, and that is the
      // assertion: recovering the signature list from a node that keeps the
      // ledger, then hydrating from the node that just said it does not, turns
      // a recovered history into "signatures but no transaction details". Do
      // not add a getTransaction handler here to make a future test pass.
      [pruning]: { getFirstAvailableBlock: PRUNING, getSignaturesForAddress: () => rpcOk([]) },
      [archival]: {
        getFirstAvailableBlock: ARCHIVAL,
        getSignaturesForAddress: () => rpcOk(SIGS),
        getTransaction: () => rpcOk(RAW_TX),
      },
    }))

    const txs = await getSolanaRecentTransactionsRpc("wallet", undefined, 5)
    expect(txs).toHaveLength(1)
  })

  it("is a real answer once an archival endpoint agrees it is empty", async () => {
    const pruning = nextEndpoint()
    const archival = nextEndpoint()
    vi.stubEnv("SOLANA_RPC_URLS", `${pruning},${archival}`)
    vi.stubGlobal("fetch", nodesReturning({
      [pruning]: { getFirstAvailableBlock: PRUNING, getSignaturesForAddress: () => rpcOk([]) },
      [archival]: { getFirstAvailableBlock: ARCHIVAL, getSignaturesForAddress: () => rpcOk([]) },
    }))

    await expect(getSolanaRecentTransactionsRpc("wallet", undefined, 5)).resolves.toEqual([])
  })

  it("still refuses when no archival endpoint can be reached", async () => {
    // The guard is the floor. Failover is an attempt to do better, never a
    // reason to soften what happens when it does not work.
    const pruning = nextEndpoint()
    const dead = nextEndpoint()
    vi.stubEnv("SOLANA_RPC_URLS", `${pruning},${dead}`)
    vi.stubGlobal("fetch", nodesReturning({
      [pruning]: { getFirstAvailableBlock: PRUNING, getSignaturesForAddress: () => rpcOk([]) },
      [dead]: { getFirstAvailableBlock: () => json({}, 503), getSignaturesForAddress: () => json({}, 503) },
    }))

    await expect(getSolanaRecentTransactionsRpc("wallet", undefined, 5))
      .rejects.toBeInstanceOf(SolanaLookupUnavailableError)
  })

  it("does not retry when the answering endpoint is already archival", async () => {
    const archival = nextEndpoint()
    const other = nextEndpoint()
    vi.stubEnv("SOLANA_RPC_URLS", `${archival},${other}`)
    const fetchMock = nodesReturning({
      [archival]: { getFirstAvailableBlock: ARCHIVAL, getSignaturesForAddress: () => rpcOk([]) },
      [other]: { getFirstAvailableBlock: ARCHIVAL, getSignaturesForAddress: () => rpcOk(SIGS) },
    })
    vi.stubGlobal("fetch", fetchMock)

    await expect(getSolanaRecentTransactionsRpc("wallet", undefined, 5)).resolves.toEqual([])
    const asked = fetchMock.mock.calls.map(c => c[0])
    expect(asked).not.toContain(other)
  })
})

describe("a single configured endpoint that prunes", () => {
  it("falls back to the public archival node, which is the whole configuration a operator is likely to have", async () => {
    // Providers are configured one URL at a time, so the realistic shape of
    // this problem is ONE fast endpoint and no second opinion available. The
    // public node is free and archival (first block 0, measured 2026-09-09),
    // which makes it a usable last resort for exactly this query.
    const pruning = nextEndpoint()
    vi.stubEnv("SOLANA_RPC_URLS", pruning)
    vi.stubGlobal("fetch", nodesReturning({
      [pruning]: { getFirstAvailableBlock: PRUNING, getSignaturesForAddress: () => rpcOk([]) },
      "https://api.mainnet-beta.solana.com": {
        getFirstAvailableBlock: ARCHIVAL,
        getSignaturesForAddress: () => rpcOk([{ signature: "sig-1" }]),
        getTransaction: () => rpcOk({
          slot: 1, blockTime: 1757000000,
          transaction: { signatures: ["sig-1"], message: { accountKeys: [], instructions: [] } },
          meta: { err: null, fee: 5000, preBalances: [], postBalances: [], logMessages: [] },
        }),
      },
    }))

    const txs = await getSolanaRecentTransactionsRpc("wallet", undefined, 5)
    expect(txs).toHaveLength(1)
  })

  it("does not route ordinary queries to the public node behind the operator's back", async () => {
    // The backstop is for the empty-and-pruning case only. Widening it to the
    // normal fan-out would mean a misconfigured endpoint quietly still works,
    // and the admin console would have nothing to report.
    const configured = nextEndpoint()
    const fetchMock = nodesReturning({
      [configured]: { getBalance: () => json({}, 503), getTokenAccountsByOwner: () => json({}, 503) },
    })
    vi.stubEnv("SOLANA_RPC_URLS", configured)
    vi.stubGlobal("fetch", fetchMock)

    await expect(getSolanaWalletBalanceRpc("wallet")).rejects.toBeInstanceOf(SolanaLookupUnavailableError)
    expect(fetchMock.mock.calls.map(c => c[0])).not.toContain("https://api.mainnet-beta.solana.com")
  })
})
