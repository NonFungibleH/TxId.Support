/**
 * How much of Stellar's real failure volume can we actually explain?
 *
 *   npx tsx packages/stellar/scripts/census.ts [pages]
 *
 * Run this before claiming a coverage number anywhere. It samples live ledgers
 * through Soroban RPC (which returns a whole range with statuses in one call),
 * decodes every failure with the real decoder, and reports three separate
 * things that are easy to conflate: how often we NAME the failing operation,
 * how often we hold ENGLISH for that name, and how often the walk stopped
 * before reaching any failure at all.
 */
import { explain } from "../src/codes"
import { soroban } from "../src/rpc"
import { decodeTransactionResult } from "../src/xdr"

async function main() {
  const pages = Number(process.argv[2] ?? 6)
  const latest = await soroban("getLatestLedger", {})
  if (!latest.ok) throw new Error(`no Soroban endpoint answered: ${latest.reason}`)
  let seq = (latest.result as { sequence: number }).sequence - 400

  let total = 0, failed = 0, named = 0, explained = 0, incomplete = 0
  const codes: Record<string, number> = {}
  const ops: Record<string, number> = {}
  for (let page = 0; page < pages; page++) {
    const b = await soroban("getTransactions", { startLedger: seq, pagination: { limit: 200 } })
    if (!b.ok) { process.stderr.write(`stopped: ${b.reason}\n`); break }
    const rows = (b.result as { transactions?: { status: string; resultXdr: string; ledger: number }[] }).transactions ?? []
    if (rows.length === 0) break
    for (const t of rows) {
      total++
      if (t.status !== "FAILED") continue
      failed++
      const d = decodeTransactionResult(t.resultXdr)
      if (d?.incomplete && !d.failing) incomplete++
      const n = d?.failing?.name
      if (n) {
        named++
        if (explain(n)) explained++
        codes[n] = (codes[n] ?? 0) + 1
        if (d?.failing?.type) ops[d.failing.type] = (ops[d.failing.type] ?? 0) + 1
      }
    }
    seq = rows[rows.length - 1]!.ledger + 1
  }

  const pct = (n: number) => `${(100 * n / Math.max(failed, 1)).toFixed(1)}%`
  console.log(`${total} transactions, ${failed} failed (${(100 * failed / Math.max(total, 1)).toFixed(1)}%)\n`)
  console.log(`  named the failing operation:      ${named} (${pct(named)})`)
  console.log(`  and we hold English for it:       ${explained} (${pct(explained)})`)
  console.log(`  walk stopped before any failure:  ${incomplete} (${pct(incomplete)})\n`)
  console.log("FAILING OPERATION:")
  for (const [k, v] of Object.entries(ops).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(5)}  ${k}`)
  console.log("\nCODES (?? means we hold no English for it):")
  for (const [k, v] of Object.entries(codes).sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`  ${String(v).padStart(5)}  ${explain(k) ? "  " : "??"} ${k}`)
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
