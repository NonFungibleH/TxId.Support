/**
 * Task 9: curated failed-tx diagnosis tuning for the demo protocols
 * (Decibel, Thala, Aries Markets, Amnis Finance, PancakeSwap-Aptos).
 *
 * REAL section: every entry is a real failed Aptos mainnet transaction,
 * discovered 2026-07-24/25 by scanning the raw fullnode transaction stream and
 * the histories of active protocol traders (the Indexer's account_transactions
 * cannot surface these: a failed tx writes nothing to the protocol account, so
 * it is only ever linked to its sender). Hashes are hardcoded so the run is
 * reproducible; each goes through the REAL getAptosTransactionByHash(hash,
 * PROTOCOL_ERRMAPS) path.
 *
 * Discovery notes (what limited the real set):
 * - Failure diversity on mainnet is dominated by slippage aborts from arb bots
 *   (ThalaSwap v1 + PancakeSwap below). That IS the common real failure mode.
 * - Decibel traders transact through gas-station/subaccount flows, so their
 *   accounts keep sequence_number 0 and /accounts/{addr}/transactions is empty;
 *   only raw ledger sweeps surface Decibel failures. One live failure was
 *   captured; anonymous-tier rate limits capped further sweeping.
 * - No live failed tx was found for Aries, Amnis, or ThalaSwap v2 within the
 *   request budget.
 *
 * CANNED section: for protocols without a live failure, real vm_status FORMATS
 * (exactly as fullnodes render them) with codes taken from the protocol's
 * published on-chain source (Amnis), its official SDK error reference
 * (Decibel), or bare codes (Aries, Thala v2, which publish no source) are fed
 * through the same decoder. For bare-code cases the pass bar is the HONEST
 * framing: module and code stated plainly, no invented certainty.
 *
 * Asserted pass bar:
 * - every case decodes with cause !== "unknown"
 * - every reason is non-empty and contains no "undefined"/"null" text
 * - at least half of all decoded aborts carry an errorName or a category
 * - canned honest-framing cases must NOT overclaim (no invented mapped reason)
 * The real bar, checked by reading the output: a non-expert should know what
 * to do next after each reason.
 *
 * Run: pnpm --filter @txid/aptos exec tsx scripts/tune-diagnosis.ts
 */
import { decodeAbort } from "../src/abort"
import { getAptosTransactionByHash } from "../src/fullnode"
import { PROTOCOL_ERRMAPS } from "../src/errmap"

type Protocol = "decibel" | "thala" | "aries" | "amnis" | "pancakeswap"

interface CuratedTx {
  hash: string
  protocol: Protocol
  /** What the failure should read as, from the on-chain evidence. */
  expectedShape: string
}

const CURATED: CuratedTx[] = [
  // Decibel: user cancelling a TP/SL order whose id no longer matches a live
  // order (already triggered or cancelled). Entry: dex_accounts_entry::
  // cancel_tp_sl_order_for_position; abort: position_tp_sl EINVALID_TP_SL_ORDER_ID(0x10010).
  {
    hash: "0x3f12a009637c86ea97925553600d056e4cd4c35db41c9e0d657eb8489d838b33",
    protocol: "decibel",
    expectedShape: "stale TP/SL order id: tell the trader the order is already gone, refresh and stop retrying",
  },
  // ThalaSwap v1: swap_exact_in slippage aborts (ERR_INSUFFICIENT_OUTPUT(0x1))
  // from an active trader. Four kept of eight found: this is the single most
  // common real failure on the protocol.
  {
    hash: "0x0418da4d1d47bd777a6fa5d379f882e0ef9269c3cf5f8ee1aa77530d75725a50",
    protocol: "thala",
    expectedShape: "slippage: output below minimum, nothing swapped, retry with slightly higher tolerance",
  },
  {
    hash: "0x936cd11f2c39e31a86b3cd9c35e9888e942ac203d8a19659ea650bb1f9edc12f",
    protocol: "thala",
    expectedShape: "slippage: output below minimum, nothing swapped, retry with slightly higher tolerance",
  },
  {
    hash: "0xc134a95bf8b2cbd37580f56a13c50ea30802928a6236ab80d428c6e56d547e34",
    protocol: "thala",
    expectedShape: "slippage: output below minimum, nothing swapped, retry with slightly higher tolerance",
  },
  {
    hash: "0xbaad1f2679bbf61889a30afd431b6a05d835a4c485dc2772f937877c4f67b579",
    protocol: "thala",
    expectedShape: "slippage: output below minimum, nothing swapped, retry with slightly higher tolerance",
  },
  // PancakeSwap-Aptos: router E_OUTPUT_LESS_THAN_MIN(0x0) slippage aborts on
  // swap_exact_input from an active trader.
  {
    hash: "0x62c28ae8706d59e2fba3456d06d294aab4a80b1813abb4a949de4a834141d7c8",
    protocol: "pancakeswap",
    expectedShape: "slippage: received amount fell below minimum, retry or raise slippage tolerance",
  },
  {
    hash: "0x20bfefcc66de8960a0dc50054d5d583bd65d0d3f4474e7eeb714b7b961c6535f",
    protocol: "pancakeswap",
    expectedShape: "slippage: received amount fell below minimum, retry or raise slippage tolerance",
  },
  {
    hash: "0x616d6d12f556b87b95e524d738b2fe4e611fcbb7df4640024ef81c71e59bb9ad",
    protocol: "pancakeswap",
    expectedShape: "slippage: received amount fell below minimum, retry or raise slippage tolerance",
  },
  {
    hash: "0x46c30b71dabed3017d2eb21b5bc0fedac218ad4366f87b0e49e4a3ce6654eb68",
    protocol: "pancakeswap",
    expectedShape: "slippage: received amount fell below minimum, retry or raise slippage tolerance",
  },
]

const DECIBEL = "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06"
const ARIES = "0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3"
const AMNIS = "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a"
const THALA_V2 = "0x007730cd28ee1cdc9e999336cbc430f99e7c44397c0aa77516f6f23a78559bb5"

interface CannedCase {
  protocol: Protocol
  vmStatus: string
  /** Errmap entry expected to render (absent = honest-framing case). */
  expectErrName?: string
  expectedShape: string
}

const CANNED: CannedCase[] = [
  // Decibel constants from the official SDK error reference, rendered exactly
  // as fullnodes print named aborts (name + canonically wrapped code).
  {
    protocol: "decibel",
    vmStatus: `Move abort in ${DECIBEL}::perp_engine: EMARKET_HALTED(0x30004): `,
    expectErrName: "EMARKET_HALTED",
    expectedShape: "market halted: exchange-side pause, funds fine, wait and retry",
  },
  {
    protocol: "decibel",
    vmStatus: `Move abort in ${DECIBEL}::perp_market_config: ESIZE_NOT_RESPECTING_MIN_SIZE(0x10004): `,
    expectErrName: "ESIZE_NOT_RESPECTING_MIN_SIZE",
    expectedShape: "order below market minimum size: increase size",
  },
  {
    protocol: "decibel",
    vmStatus: `Move abort in ${DECIBEL}::clearinghouse_perp: ESELF_TRADE_NOT_ALLOWED(0x10007): `,
    expectErrName: "ESELF_TRADE_NOT_ALLOWED",
    expectedShape: "order would match own resting order: cancel opposing order or adjust price",
  },
  {
    protocol: "decibel",
    vmStatus: `Move abort in ${DECIBEL}::tp_sl_utils: EINVALID_TP_SL_PARAMETERS(0x10001): `,
    expectErrName: "EINVALID_TP_SL_PARAMETERS",
    expectedShape: "TP/SL on wrong side of price: fix prices per position direction",
  },
  // Amnis codes are plain (unwrapped) in its published on-chain source.
  {
    protocol: "amnis",
    vmStatus: `Move abort in ${AMNIS}::router: 2`,
    expectErrName: "EINSUFFICIENT_DEPOSIT_AMOUNT",
    expectedShape: "deposit below Amnis minimum: deposit slightly more APT",
  },
  {
    protocol: "amnis",
    vmStatus: `Move abort in ${AMNIS}::withdrawal: 1`,
    expectErrName: "ETOKEN_LOCK_NOT_EXPIRED",
    expectedShape: "withdrawal still unbonding: wait until lockup ends, then claim",
  },
  // Aries publishes no source and no live failure was captured: bare-code
  // aborts must render the HONEST module+code framing, never invented detail.
  {
    protocol: "aries",
    vmStatus: `Move abort in ${ARIES}::controller: 1007`,
    expectedShape: "honest: module+code stated plainly, no invented certainty",
  },
  {
    protocol: "aries",
    vmStatus: `Move abort in ${ARIES}::profile: 0x10002`,
    expectedShape: "honest: category framing (invalid argument), no invented certainty",
  },
  // ThalaSwap v2 pool, bare code: honest framing.
  {
    protocol: "thala",
    vmStatus: `Move abort in ${THALA_V2}::pool: 0x4`,
    expectedShape: "honest: module+code stated plainly, no invented certainty",
  },
]

function pause(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main(): Promise<void> {
  let failures = 0
  let withNameOrCategory = 0
  let decoded = 0
  const perProtocol: Record<string, { real: number; canned: number }> = {}
  const bump = (p: Protocol, kind: "real" | "canned") => {
    const row = perProtocol[p] ?? { real: 0, canned: 0 }
    row[kind]++
    perProtocol[p] = row
  }

  console.log(`=== REAL failed mainnet txs (${CURATED.length}) ===`)
  for (const [i, curated] of CURATED.entries()) {
    if (i > 0) await pause(1500)
    const tx = await getAptosTransactionByHash(curated.hash, PROTOCOL_ERRMAPS)
    console.log(`\n[real ${i + 1}/${CURATED.length}] ${curated.protocol}  ${curated.hash}`)
    if (!tx) {
      console.log("  FETCH FAILED (fullnode unreachable)")
      failures++
      continue
    }
    bump(curated.protocol, "real")
    console.log(`  entry:     ${tx.functionId ?? "(none)"}`)
    console.log(`  vm_status: ${tx.vmStatus}`)
    console.log(`  expected:  ${curated.expectedShape}`)
    const d = tx.decodedAbort
    if (tx.success || !d) {
      console.log("  ERROR: expected a failed tx with decodedAbort")
      failures++
      continue
    }
    decoded++
    console.log(`  cause=${d.cause} module=${d.module ?? "-"} code=${d.code ?? "-"} category=${d.category ?? "-"} errorName=${d.errorName ?? "-"}`)
    console.log(`  REASON: ${d.reason}`)
    const problems: string[] = []
    if (d.cause === "unknown") problems.push("cause is unknown")
    if (!d.reason || d.reason.trim().length === 0) problems.push("empty reason")
    if (/\bundefined\b|\bnull\b/.test(d.reason)) problems.push("reason leaks undefined/null")
    if (d.errorName || d.category) withNameOrCategory++
    if (problems.length > 0) {
      console.log(`  ASSERT FAIL: ${problems.join("; ")}`)
      failures++
    }
  }

  console.log(`\n=== CANNED vm_status cases (${CANNED.length}): no live failure found for these shapes ===`)
  for (const [i, c] of CANNED.entries()) {
    const d = decodeAbort(c.vmStatus, PROTOCOL_ERRMAPS)
    bump(c.protocol, "canned")
    decoded++
    console.log(`\n[canned ${i + 1}/${CANNED.length}] ${c.protocol}`)
    console.log(`  vm_status: ${c.vmStatus}`)
    console.log(`  expected:  ${c.expectedShape}`)
    console.log(`  cause=${d.cause} module=${d.module ?? "-"} code=${d.code ?? "-"} category=${d.category ?? "-"} errorName=${d.errorName ?? "-"}`)
    console.log(`  REASON: ${d.reason}`)
    const problems: string[] = []
    if (d.cause === "unknown") problems.push("cause is unknown")
    if (!d.reason || d.reason.trim().length === 0) problems.push("empty reason")
    if (/\bundefined\b|\bnull\b/.test(d.reason)) problems.push("reason leaks undefined/null")
    if (c.expectErrName) {
      if (d.errorName !== c.expectErrName) problems.push(`expected errmap entry ${c.expectErrName}, got ${d.errorName}`)
    } else {
      // honest-framing pass bar: the decoder must say the module publishes no
      // description for this code, and must not invent a mapped reason
      if (!/doesn't publish a description/.test(d.reason)) problems.push("honest framing missing")
    }
    if (d.errorName || d.category) withNameOrCategory++
    if (problems.length > 0) {
      console.log(`  ASSERT FAIL: ${problems.join("; ")}`)
      failures++
    }
  }

  console.log(`\n--- summary ---`)
  console.log(`cases: ${CURATED.length} real + ${CANNED.length} canned, decoded aborts: ${decoded}, with errorName/category: ${withNameOrCategory}`)
  console.log(`per protocol (real/canned): ${JSON.stringify(perProtocol)}`)
  if (decoded > 0 && withNameOrCategory * 2 < decoded) {
    console.log("ASSERT FAIL: fewer than half of decoded aborts carry an errorName or category")
    failures++
  }
  if (failures > 0) {
    console.log(`RESULT: FAIL (${failures} problems)`)
    process.exit(1)
  }
  console.log("RESULT: PASS")
}

main().catch(err => {
  console.error("tune-diagnosis crashed:", err)
  process.exit(1)
})
