import { describe, it, expect } from "vitest"
import { getTransactionByHash } from "./wallet"

/**
 * Live check against the three transactions a user was wrongly told did not
 * exist. Run deliberately, not in CI: it hits the public BSC RPC.
 *
 * No MORALIS_API_KEY is set here, which reproduces the production symptom
 * exactly: the indexer path is unavailable and the fallback must carry it.
 */
describe.skipIf(!process.env.LIVE)("the three misreported transactions", () => {
  it.each([
    "0x484cf93b31ffe7c01bfa04a241dd0e0f62309768e538c6dbbd17f5368a863538",
    "0x09bcb14936ffa917e48abf3760738758bd42c33ff0cbc203210fe7c4d3fe64fd",
    "0xda8540a6bac907eded6a8d89b16d1d98ecc7982d20dcba0b6d3ec31b20aca5f7",
  ])("%s is found on BNB Chain", async hash => {
    const tx = await getTransactionByHash(hash, "0x38")
    expect(tx, "was reported to a user as never having existed").not.toBeNull()
    expect(tx!.status).toBe("success")
    console.log(`  FOUND block ${tx!.blockNumber} status ${tx!.status} to ${tx!.to}`)
  }, 30_000)
})
