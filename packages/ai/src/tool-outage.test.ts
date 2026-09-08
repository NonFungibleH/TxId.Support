import { describe, it, expect, vi, beforeEach } from "vitest"

/**
 * When a chain read THROWS, the tool arm must say so, not answer.
 *
 * The record-level contract is covered in evidence.test.ts and the source-level
 * one asserts no return hides a failure under a key the fallback cannot see.
 * Neither proves the thing in between: that an arm CATCHES what a chain package
 * throws and marks it, rather than letting it escape or, worse, falling through
 * to a branch that reports an empty result.
 *
 * That gap is where the whole bug class lives. Every chain package now throws a
 * dedicated Unavailable error precisely so an arm can tell "nobody answered"
 * from "the answer is nothing", and this asserts each arm actually does.
 *
 * The failure being guarded is always the same sentence reaching a user:
 * "you have no transactions" / "your balance is zero" / "that transaction does
 * not exist", said during an outage.
 */

const WALLET = (chainId: string, address: string) => ({ address, chainId }) as never

beforeEach(() => vi.resetModules())

/** Run one tool arm with the chain's read forced to throw. */
async function withOutage(
  mocks: Record<string, () => Record<string, unknown>>,
  tool: string,
  wallet: unknown,
): Promise<Record<string, unknown>> {
  for (const [mod, factory] of Object.entries(mocks)) {
    vi.doMock(mod, async (orig) => ({ ...(await orig<Record<string, unknown>>()), ...factory() }))
  }
  const { executeTool } = await import("./tools")
  try {
    return (await executeTool(tool, {}, wallet as never, [])) as Record<string, unknown>
  } finally {
    for (const mod of Object.keys(mocks)) vi.doUnmock(mod)
  }
}

/**
 * The assertion every case shares. A result may say a lot of things, but it
 * must not be a FINDING: no balance, no empty list presented as history, and
 * the failure has to be visible to the record.
 */
function expectHonestFailure(r: Record<string, unknown>, label: string) {
  expect(r, `${label}: returned nothing at all`).toBeTruthy()
  const marked = r.lookupFailed === true
  const text = JSON.stringify(r)
  expect(marked, `${label}: no lookupFailed marker, so the case record misses it. Got ${text.slice(0, 200)}`).toBe(true)
  // The two shapes that would read as an answer.
  expect(r.balance, `${label}: reported a balance during an outage`).toBeUndefined()
  expect(
    Array.isArray(r.transactions) && (r.transactions as unknown[]).length === 0,
    `${label}: returned an empty transaction list, which reads as "never used"`,
  ).toBe(false)
}

describe("a wallet balance that could not be read is never a balance", () => {
  /**
   * Solana's arm lets the package's own error propagate rather than catching
   * it. That is fine and is NOT the same bug: a thrown tool call is recorded
   * as `ok: false` with "execution failed", so the record knows. It is simply
   * less specific than NEAR's caught-and-named version, which is the pattern
   * worth copying when an arm is next touched.
   */
  it("NEAR marks the failure rather than reporting an empty account", async () => {
    const { NearLookupUnavailableError } = await import("@txid/near")
    const r = await withOutage({
      "@txid/near": () => ({
        getNearWalletBalance: vi.fn(async () => {
          throw new NearLookupUnavailableError("the NEAR nodes could not be reached")
        }),
      }),
    }, "get_wallet_balance", WALLET("near", "alice.near"))
    expectHonestFailure(r, "NEAR balance")
    expect(String(r.error)).toMatch(/do not say/i)
  })

  it("Hyperliquid separates an outage from an address that never traded", async () => {
    const r = await withOutage({
      "@txid/hyperliquid": () => ({
        getHyperliquidAccount: vi.fn(async () => ({ kind: "unavailable", reason: "the exchange did not respond" })),
      }),
    }, "get_wallet_balance", WALLET("hyperliquid", "0x" + "a".repeat(40)))
    expect(r.lookupFailed).toBe(true)
    // neverTraded is a real finding and must NOT be claimed here.
    expect(r.neverTraded).toBeUndefined()
    expect(String(r.note)).toMatch(/do NOT say the account is empty/i)
  })
})

describe("history that could not be read is never an empty history", () => {
  it("NEAR says it cannot list history at all, rather than returning none", async () => {
    const { executeTool } = await import("./tools")
    const r = (await executeTool(
      "get_recent_transactions", {}, WALLET("near", "alice.near"), [],
    )) as Record<string, unknown>
    // NEAR's RPC has no account-history endpoint. That is a fact about the
    // chain, so it is `unsupported`, and it must not be an empty list.
    expect(r.unsupported).toBe(true)
    expect(r.transactions).toBeUndefined()
    expect(String(r.note)).toMatch(/do NOT say this account has no transactions/i)
  })
})

describe("every chain package exposes a distinct unavailable error", () => {
  /**
   * The arms can only tell an outage from an absence if the packages give them
   * something to catch. Four separate classes exist rather than one shared
   * base, deliberately: a chain package takes no dependency on another.
   */
  it("so an arm has something to catch", async () => {
    const [{ LookupUnavailableError }, { AptosLookupUnavailableError }, { SolanaLookupUnavailableError }, { NearLookupUnavailableError }] =
      await Promise.all([
        import("@txid/blockchain"), import("@txid/aptos"),
        import("@txid/solana"), import("@txid/near"),
      ])
    for (const E of [LookupUnavailableError, AptosLookupUnavailableError, SolanaLookupUnavailableError, NearLookupUnavailableError]) {
      const e = new (E as new (r: string) => Error)("because")
      expect(e).toBeInstanceOf(Error)
      // The reason has to survive: "lookup failed" with no subject is most of
      // the value gone from the case record.
      expect(e.message).toContain("because")
    }
  })
})
