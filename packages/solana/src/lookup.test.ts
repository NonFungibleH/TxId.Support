import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { getSolanaTransactionBySignature } from "./helius"
import { SolanaLookupUnavailableError } from "./lookup"

/**
 * The bug this guards: `if (!res.ok) return null` gave a Helius 500, a 429 and
 * a timeout the SAME value as a signature that genuinely is not on chain. An
 * outage therefore reached the user as "that transaction does not exist",
 * which is the exact shape of #68 on the EVM side and the most frightening
 * thing we can say to somebody looking for their money.
 *
 * Every case below returned `null` before the fix; only the last one should.
 */
const SIG = "5wHu1qwD4kLwYpTgHT2X1JVJnBmLh6BXfLFf2Kkq8vXNjfhX2q7XKb9pP1cVQnCu1RzX8YHhJmMx1TqRZv3aBcDe"

describe("a Solana outage is not an absence", () => {
  beforeEach(() => { process.env.HELIUS_API_KEY = "test-key" })
  afterEach(() => { vi.unstubAllGlobals() })

  it.each([500, 502, 429, 401])("throws rather than returning null on HTTP %i", async (status) => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status })))
    await expect(getSolanaTransactionBySignature(SIG)).rejects.toBeInstanceOf(SolanaLookupUnavailableError)
  })

  it("throws when the network never answered", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("socket hang up") }))
    await expect(getSolanaTransactionBySignature(SIG)).rejects.toBeInstanceOf(SolanaLookupUnavailableError)
  })

  it("throws when the body is not readable JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>gateway</html>", { status: 200 })))
    await expect(getSolanaTransactionBySignature(SIG)).rejects.toBeInstanceOf(SolanaLookupUnavailableError)
  })

  // The one case that legitimately IS null: the indexer answered, and looked,
  // and has no such signature.
  it("returns null only when Helius answered and found nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("[]", { status: 200, headers: { "content-type": "application/json" } })))
    await expect(getSolanaTransactionBySignature(SIG)).resolves.toBeNull()
  })
})
