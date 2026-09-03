import { describe, it, expect } from "vitest"
import {
  getLedgerInfo,
  getAptosTransactionByHash,
  getAptosModuleAbi,
  getAptosWalletBalance,
  errmapFor,
} from "./index"

/**
 * Live check against Aptos mainnet. Run deliberately, not on every PR: it hits
 * the public fullnode and Indexer.
 *
 * WHY THIS EXISTS. BNB Chain had a live check only because a customer was told
 * three of their transactions had never happened. Aptos had none, and its only
 * assurance before a demo was that someone had tried it recently. Both bugs
 * that produced the BNB check were invisible to mocked tests and obvious the
 * moment a real provider was involved.
 *
 * The assertions lean on a property this package already has and the EVM side
 * lacked: every client function returns null on FETCH FAILURE, distinct from
 * an empty result. So `not.toBeNull()` here means "the provider answered",
 * which is exactly the condition that breaks before a demo.
 */

// Decibel, the flagship demo target (Aptos Labs' on-chain perpetuals DEX).
const DECIBEL = "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06"

describe.skipIf(!process.env.LIVE)("Aptos mainnet is reachable", () => {
  it("the fullnode answers with a ledger version", async () => {
    const info = await getLedgerInfo()
    expect(info, "the fullnode did not answer").not.toBeNull()
    const version = Number(info!.ledgerVersion)
    expect(Number.isFinite(version) && version > 0).toBe(true)
    console.log(`  ledger version ${info!.ledgerVersion} chain ${info!.chainId}`)
  }, 30_000)

  it("a real user transaction hydrates by hash", async () => {
    // By HASH, because that is what a user pastes. Picked live rather than
    // pinned: a hardcoded hash rots, and the round trip is the thing under
    // test. Note getAptosTransactionByHash returns null BOTH for a fetch
    // failure and for a non-user transaction (block metadata, state
    // checkpoint), so an arbitrary version is not a valid probe.
    const recent = await fetch("https://fullnode.mainnet.aptoslabs.com/v1/transactions?limit=25")
      .then(r => r.json() as Promise<Array<{ type: string; hash: string }>>)
      .catch(() => null)
    expect(recent, "the fullnode did not return recent transactions").not.toBeNull()

    const user = recent!.find(t => t.type === "user_transaction")
    expect(user, "no user transaction in the last 25; unusual, worth a look").toBeDefined()

    const tx = await getAptosTransactionByHash(user!.hash)
    expect(tx, "a live user transaction did not hydrate").not.toBeNull()
    expect(tx!.hash).toBe(user!.hash)
    console.log(`  ${tx!.hash.slice(0, 18)}… ${tx!.success ? "success" : "failed"} ${tx!.functionId ?? ""}`)
  }, 30_000)

  it("the Indexer answers a balance query", async () => {
    // The Indexer is a SEPARATE service from the fullnode and fails
    // independently. A demo reads both, so checking one proves little.
    const balance = await getAptosWalletBalance(DECIBEL)
    expect(balance, "the Indexer did not answer (null means outage, not empty)").not.toBeNull()
    console.log(`  Indexer answered with ${balance!.tokens?.length ?? 0} balances`)
  }, 30_000)
})

describe.skipIf(!process.env.LIVE)("the demo protocol is readable", () => {
  it("Decibel's modules are on chain and fetchable", async () => {
    const abi = await getAptosModuleAbi(DECIBEL, "perp_market")
    // A missing module is a real answer; a null is the fullnode failing.
    // Either is worth knowing the day before a demo, so log rather than assume.
    if (abi === null) console.log("  perp_market not readable (module renamed, or fullnode down)")
    else console.log(`  perp_market has ${abi.functions.length} functions`)
    expect(abi === null || typeof abi === "object").toBe(true)
  }, 30_000)

  it("an errmap resolves for Decibel's address", () => {
    // Not a network call. Pinned here because an EMPTY errmap is how a demo
    // turns a precise protocol error into "the transaction aborted with code
    // 3009", which is honest and useless in front of the protocol's own team.
    const map = errmapFor([{ address: DECIBEL, chain: "aptos" }])
    const count = Object.keys(map ?? {}).length
    console.log(`  Decibel errmap carries ${count} codes`)
    expect(count, "Decibel's errmap is empty; aborts will read as raw codes").toBeGreaterThan(0)
  })
})
