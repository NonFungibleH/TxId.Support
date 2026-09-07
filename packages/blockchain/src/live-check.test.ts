import { describe, it, expect } from "vitest"
import { getTransactionByHash } from "./wallet"
import { CHAIN_CONFIGS } from "./types"

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

  // A wagmi or viem host sends 56, not 0x38. Against mocks this looked fine;
  // against real providers the decimal id resolved to Ethereum and the same
  // three transactions vanished again. Only a live call shows it.
  it("finds the same transaction whichever way the chain id is spelled", async () => {
    const hash = "0x484cf93b31ffe7c01bfa04a241dd0e0f62309768e538c6dbbd17f5368a863538"
    const [hex, decimal] = await Promise.all([
      getTransactionByHash(hash, "0x38"),
      getTransactionByHash(hash, "56"),
    ])
    expect(decimal, "a decimal chain id must not lose the transaction").not.toBeNull()
    expect(decimal!.hash).toBe(hex!.hash)
    expect(decimal!.status).toBe(hex!.status)
    console.log(`  0x38 and 56 agree: block ${decimal!.blockNumber} ${decimal!.status}`)
  }, 30_000)
})

/**
 * Robinhood Chain (4663) has no indexer wired: Moralis does not cover it, and
 * its Blockscout sits behind a Cloudflare bot challenge we will not defeat. So
 * the ENTIRE chain rides on one public RPC, which is exactly the arrangement
 * that rotted on Ethereum (cloudflare-eth decommissioned) and Polygon ("tenant
 * disabled"). This check exists to notice that happening.
 *
 * It picks a transaction from the current tip rather than hardcoding a hash,
 * because a single-RPC chain with no archive guarantee may not retain one.
 */
describe.skipIf(!process.env.LIVE)("Robinhood Chain rides on one RPC", () => {
  it("resolves a live transaction by both spellings of the chain id", async () => {
    const rpc = CHAIN_CONFIGS["0x1237"]!.rpcUrl
    const call = async (method: string, params: unknown[]) => {
      const r = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(20_000),
      })
      return ((await r.json()) as { result?: unknown }).result
    }

    const chainId = (await call("eth_chainId", [])) as string
    expect(chainId, "the public RPC no longer serves Robinhood Chain").toBe("0x1237")

    const tip = parseInt((await call("eth_blockNumber", [])) as string, 16)
    let hash: string | null = null
    for (let i = 0; i < 10 && !hash; i++) {
      const block = (await call("eth_getBlockByNumber", ["0x" + (tip - i).toString(16), true])) as
        | { transactions?: { hash: string; gas: string }[] }
        | null
      // Skip the per-block system transaction (type 0x6a, gas 0x0): a user
      // never pastes one, and it is not a useful round-trip subject.
      hash = block?.transactions?.find(t => t.gas !== "0x0")?.hash ?? null
    }
    expect(hash, "no ordinary transaction found near the tip").not.toBeNull()

    const [hex, decimal] = await Promise.all([
      getTransactionByHash(hash!, "0x1237"),
      getTransactionByHash(hash!, "4663"),
    ])
    expect(hex, "RPC-only chain must still resolve a transaction").not.toBeNull()
    expect(decimal, "a decimal chain id must not lose the transaction").not.toBeNull()
    expect(decimal!.hash).toBe(hex!.hash)
    console.log(`  Robinhood Chain OK: block ${hex!.blockNumber} ${hex!.status}`)
  }, 60_000)
})
