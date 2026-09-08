/**
 * Point the real decoder at real mainnet failures and print what a user would
 * be told. No mocks. Run it before trusting anything in this package.
 *
 *   npx tsx packages/stellar/scripts/verify-live.ts [transactions]
 */
import { getStellarBalance, getStellarRecentTransactions, getStellarTransaction } from "../src/client"
import { soroban } from "../src/rpc"

async function main() {
  const want = Number(process.argv[2] ?? 12)

  const latest = await soroban("getLatestLedger", {})
  if (!latest.ok) throw new Error(`no Soroban endpoint answered: ${latest.reason}`)
  const seq = (latest.result as { sequence: number }).sequence
  console.log(`latest ledger ${seq}\n`)

  // Soroban RPC hands back a whole ledger range with statuses in one call, which
  // is the cheapest way to find real failures to run the decoder against.
  const batch = await soroban("getTransactions", { startLedger: seq - 40, pagination: { limit: 200 } })
  if (!batch.ok) throw new Error(`getTransactions: ${batch.reason}`)
  const rows = (batch.result as { transactions?: { status: string; txHash: string }[] }).transactions ?? []
  const failed = rows.filter(t => t.status === "FAILED")
  console.log(`${rows.length} transactions in the window, ${failed.length} failed (${(100 * failed.length / Math.max(rows.length, 1)).toFixed(1)}%)\n`)

  let explained = 0
  let floor = 0
  const seen = new Set<string>()
  for (const t of failed.slice(0, want)) {
    const r = await getStellarTransaction(t.txHash)
    if (r.kind !== "ok") { console.log(`  ${t.txHash.slice(0, 12)}… lookup ${r.kind}`); continue }
    const d = r.value.decodedResult
    const op = d?.failing
    const key = op?.name ?? d?.code ?? "?"
    seen.add(key)
    if (op?.name && !/^unknown/.test(key)) explained++
    else floor++
    console.log(`  ${t.txHash.slice(0, 12)}…  ${d?.code}  ${op?.type ?? "-"}  ${op?.name ?? "(no operation read)"}${d?.incomplete ? "  [walk incomplete]" : ""}`)
    console.log(`     age ${r.value.age ?? "-"}, fee ${r.value.feeXlm ?? "-"}, ops ${r.value.operationCount ?? "-"}`)
    console.log(`     ANSWER  ${r.value.reason}\n`)
  }
  console.log(`named an operation error on ${explained} of ${explained + floor}; distinct codes seen: ${[...seen].join(", ")}`)

  // A real account, read the way the agent reads one.
  const sample = rows.find(t => t.status === "SUCCESS")
  if (sample) {
    const tx = await getStellarTransaction(sample.txHash)
    if (tx.kind === "ok" && tx.value.sourceAccount) {
      const b = await getStellarBalance(tx.value.sourceAccount)
      console.log(`\naccount ${tx.value.sourceAccount.slice(0, 10)}… balance: ${b.kind === "ok" ? `${b.value.xlm} XLM, ${b.value.balances.length} asset lines, reserve ${b.value.reserveXlm ?? "?"} XLM (${b.value.subentryCount} subentries)` : b.kind}`)
      const h = await getStellarRecentTransactions(tx.value.sourceAccount, 5)
      console.log(`history: ${h.kind === "ok" ? `${h.value.length} rows, ${h.value.filter(x => x.status === "failed").length} failed` : h.kind}`)
    }
  }
  const missing = await getStellarTransaction("0".repeat(64))
  console.log(`\na hash Horizon has never seen: ${missing.kind} (must be not_found, never unavailable)`)
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
