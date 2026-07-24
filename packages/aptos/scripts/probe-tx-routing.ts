/**
 * Task 7 live probe: get_transaction_by_hash routing for Aptos.
 *
 * Aptos tx hashes are format-identical to EVM hashes (0x + 64 hex), so the
 * executor must route by session context, not format. This probe drives the
 * REAL executeTool path against mainnet:
 *   1. Aptos wallet config + real Aptos tx hash → resolves on "aptos"
 *   2. Aptos context + all-numeric version → short-circuits to Aptos
 *   3. Failed Aptos tx (when a hash is supplied) → decodedAbort surfaces
 *   4. EVM wallet config + real Ethereum tx hash → still routes to EVM
 *      (no MORALIS_API_KEY → asserts only that Aptos did NOT claim it)
 *
 * Run: pnpm --filter @txid/aptos exec tsx scripts/probe-tx-routing.ts [failedAptosHash]
 */
import { executeTool } from "../../ai/src/tools"
import { getAptosTransactionByHash, getLedgerInfo, aptosGet } from "../src/fullnode"
import { decodeAbort } from "../src/abort"

let failed = false
function report(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`)
  if (!ok) failed = true
}

interface RawTx {
  type: string
  hash?: string
  version?: string
  success?: boolean
  vm_status?: string
}

async function findRecentAptosTx(): Promise<{ hash: string; version: string } | null> {
  const ledger = await getLedgerInfo()
  if (!ledger) return null
  const start = Number(ledger.ledgerVersion) - 200
  const batch = await aptosGet<RawTx[]>(`/transactions?limit=100&start=${start}`)
  const tx = (batch ?? []).find(t => t.type === "user_transaction" && t.success === true)
  return tx?.hash && tx.version ? { hash: tx.hash, version: tx.version } : null
}

async function main() {
  const aptosWallet = { address: "0x1", chainId: "aptos" }
  const found = await findRecentAptosTx()
  if (!found) {
    console.log("FAIL  could not discover a recent mainnet Aptos tx (fullnode unreachable?)")
    process.exit(1)
  }
  console.log(`discovered mainnet tx: ${found.hash} (version ${found.version})\n`)

  {
    const result = (await executeTool(
      "get_transaction_by_hash",
      { hash: found.hash },
      aptosWallet,
      [],
    )) as { chainId?: string; hash?: string; version?: string; success?: boolean }
    report(
      "aptos wallet + 0x64hex hash routes to Aptos",
      result.chainId === "aptos" && result.hash === found.hash && result.success === true,
      `chainId=${result.chainId} hash=${result.hash?.slice(0, 14)}… version=${result.version}`,
    )
  }

  {
    const result = (await executeTool(
      "get_transaction_by_hash",
      { hash: found.version },
      aptosWallet,
      [],
    )) as { chainId?: string; hash?: string; version?: string }
    report(
      "all-numeric version short-circuits to Aptos",
      result.chainId === "aptos" && result.hash === found.hash,
      `chainId=${result.chainId} version=${result.version}`,
    )
  }

  {
    // watched-contract-only context (no wallet) must also put Aptos in play.
    // Watching 0x1 makes the scope guard vacuous BY DESIGN of this test:
    // every user tx emits 0x1 framework events (FeeStatement, coin/FA events),
    // so any tx is "in scope" for 0x1 — which is exactly what lets us assert
    // the tx is actually RETURNED (not out_of_scope) regardless of which tx
    // was discovered. The negative case below covers the guard rejecting.
    const watched = [
      { id: "p1", name: "Aptos Framework", address: "0x1", chain: "aptos", description: "" },
    ]
    const result = (await executeTool(
      "get_transaction_by_hash",
      { hash: found.hash },
      null,
      watched,
    )) as { chainId?: string; status?: string; success?: boolean }
    report(
      "aptos watched contract (no wallet) puts Aptos in the fan-out",
      result.chainId === "aptos" && result.status === undefined && result.success === true,
      `chainId=${result.chainId} status=${result.status ?? "found"} success=${result.success}`,
    )
  }

  {
    // Negative scope case: watch a real module account the discovered tx does
    // NOT involve — the guard must reject with out_of_scope. Two real protocol
    // accounts (PancakeSwap-Aptos router, ThalaSwap); pick one the tx doesn't
    // touch so the test can't flake on whichever tx was discovered.
    const candidates = [
      "0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa",
      "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af",
    ]
    const direct = await getAptosTransactionByHash(found.hash)
    const involved = (addr: string): boolean => {
      if (!direct) return false
      const norm = (id: string) => {
        const sep = id.indexOf("::")
        return sep === -1 ? null : id.slice(0, sep).toLowerCase()
      }
      const target = addr.toLowerCase()
      return (
        (direct.functionId ? norm(direct.functionId) === target : false) ||
        direct.events.some(e => norm(e.type) === target)
      )
    }
    const uninvolved = candidates.find(a => !involved(a))
    if (!uninvolved) {
      console.log("SKIP  out_of_scope negative case — discovered tx involves both candidate modules")
    } else {
      const watched = [
        { id: "p2", name: "Unrelated Protocol", address: uninvolved, chain: "aptos", description: "" },
      ]
      const result = (await executeTool(
        "get_transaction_by_hash",
        { hash: found.hash },
        null,
        watched,
      )) as { chainId?: string; status?: string }
      report(
        "tx not touching the watched module is rejected out_of_scope",
        result.chainId === "aptos" && result.status === "out_of_scope",
        `chainId=${result.chainId} status=${result.status ?? "found"} watched=${uninvolved.slice(0, 12)}…`,
      )
    }
  }

  const failedHash = process.argv[2]
  if (failedHash) {
    const direct = await getAptosTransactionByHash(failedHash)
    const result = (await executeTool(
      "get_transaction_by_hash",
      { hash: failedHash },
      aptosWallet,
      [],
    )) as { chainId?: string; success?: boolean; decodedAbort?: { cause: string; reason: string; module: string | null; code: number | null } }
    report(
      "failed Aptos tx surfaces decodedAbort via the tool path",
      result.chainId === "aptos" &&
        result.success === false &&
        result.decodedAbort !== undefined &&
        result.decodedAbort.reason.length > 0,
      result.decodedAbort
        ? `cause=${result.decodedAbort.cause} module=${result.decodedAbort.module} code=${result.decodedAbort.code} reason="${result.decodedAbort.reason.slice(0, 90)}"`
        : `decodedAbort missing (direct fetch success=${direct?.success})`,
    )
  } else {
    // No failed tx discovered cheaply (failure rate in recent mainnet windows
    // is ~0 and the anonymous fullnode quota limits deep scans). Fall back to
    // asserting the decoder itself on a canned vm_status — the tool path
    // attaches decodedAbort via this exact function (fullnode.ts).
    console.log("SKIP  live failed-tx check — no failed Aptos hash discovered/supplied (pass as argv[2])")
    const canned = decodeAbort("Move abort in 0x1::coin: 0x10006")
    report(
      "canned decodeAbort (0x1::coin 0x10006)",
      canned.cause === "move_abort" && canned.errorName === "EINSUFFICIENT_BALANCE" && canned.reason.length > 0,
      `cause=${canned.cause} errorName=${canned.errorName} reason="${canned.reason.slice(0, 80)}"`,
    )
  }

  {
    // EVM regression: a real, well-known Ethereum mainnet tx (the 2017 Parity
    // multisig exploit init tx is permanent and famous enough to stay valid).
    const evmHash = "0x9dbf28f21db4a5a5333563bcda52a4851f1e5851c85f80561e496db8becfbb2b"
    const evmWallet = { address: "0x0000000000000000000000000000000000000001", chainId: "0x1" }
    const result = (await executeTool(
      "get_transaction_by_hash",
      { hash: evmHash },
      evmWallet,
      [],
    )) as { chainId?: string; status?: string; hash?: string; checkedChains?: string[] }
    const routedToAptos = result.chainId === "aptos"
    const foundOnEvm = result.chainId === "0x1" && result.status === undefined
    const detail = `chainId=${result.chainId} status=${result.status ?? "found"} checkedChains=${JSON.stringify(result.checkedChains ?? null)}`
    if (foundOnEvm) {
      report("EVM hash + EVM wallet still resolves on EVM", true, detail)
    } else {
      // Without MORALIS_API_KEY the EVM fetch fails; routing must still have
      // selected only EVM candidates (never Aptos).
      report(
        "EVM hash + EVM wallet never routes to Aptos (EVM fetch may lack MORALIS_API_KEY)",
        !routedToAptos && (result.checkedChains === undefined || !result.checkedChains.includes("aptos")),
        detail,
      )
    }
  }

  console.log(failed ? "\nRESULT: FAIL" : "\nRESULT: PASS")
  if (failed) process.exit(1)
}

main().catch(err => {
  console.error("probe crashed:", err)
  process.exit(1)
})
