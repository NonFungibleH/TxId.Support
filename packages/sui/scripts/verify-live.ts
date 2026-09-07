/**
 * Point the real decoder at real mainnet failures and print what a user would
 * be told. No mocks. Run it before trusting anything in this package.
 *
 *   npx tsx packages/sui/scripts/verify-live.ts [checkpoints]
 *
 * It walks recent checkpoints, finds one failure of each kind we claim to
 * decode, then looks each one up through getSuiTransaction exactly as the agent
 * does, so the package-origin resolution and the error map are both exercised
 * on the wire rather than in a fixture.
 */
import { getSuiTransaction } from "../src/client"
import { SUI_ERRMAPS } from "../src/errmap"

const URLS = ["https://sui-rpc.publicnode.com", "https://rpc-mainnet.suiscan.xyz"]
let next = 0

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = URLS[next++ % URLS.length]!
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      })
      if (!res.ok) { await new Promise(r => setTimeout(r, 250)); continue }
      const body = (await res.json()) as { result?: unknown; error?: unknown }
      if (body.error) { await new Promise(r => setTimeout(r, 250)); continue }
      return body.result
    } catch { await new Promise(r => setTimeout(r, 250)) }
  }
  return null
}

const WANTED: { label: string; match: (status: string) => boolean }[] = [
  { label: "DeepBook abort (mapped, and at an UPGRADED address)", match: s => /Identifier\("(balance_manager|order_info|big_vector|pool|vault|book)"\)/.test(s) },
  { label: "unmapped Move abort (the honest floor)", match: s => /MoveAbort/.test(s) },
  { label: "InsufficientCoinBalance", match: s => s.startsWith("InsufficientCoinBalance") },
  { label: "InsufficientGas", match: s => s.startsWith("InsufficientGas") },
]

async function main() {
  const window = Number(process.argv[2] ?? 120)
  const latest = await rpc("sui_getLatestCheckpointSequenceNumber", [])
  if (typeof latest !== "string") throw new Error("no Sui endpoint answered")
  const start = BigInt(latest) - BigInt(window)

  const found = new Map<string, string>()
  let scanned = 0, failed = 0
  for (let i = 0; i < window && found.size < WANTED.length; i++) {
    const cp = (await rpc("sui_getCheckpoint", [(start + BigInt(i)).toString()])) as { transactions?: string[] } | null
    if (!cp?.transactions?.length) continue
    for (let j = 0; j < cp.transactions.length; j += 40) {
      const txs = (await rpc("sui_multiGetTransactionBlocks", [cp.transactions.slice(j, j + 40), { showEffects: true }])) as
        { digest?: string; effects?: { status?: { status?: string; error?: string } } }[] | null
      for (const tx of txs ?? []) {
        scanned++
        const st = tx?.effects?.status
        if (st?.status !== "failure" || !tx.digest) continue
        failed++
        for (const w of WANTED) if (!found.has(w.label) && w.match(st.error ?? "")) found.set(w.label, tx.digest)
      }
    }
  }
  console.log(`scanned ${scanned} transactions, ${failed} failed\n`)

  for (const w of WANTED) {
    const digest = found.get(w.label)
    console.log(`=== ${w.label} ===`)
    if (!digest) { console.log("  none in this window\n"); continue }
    const r = await getSuiTransaction(digest, SUI_ERRMAPS)
    if (r.kind !== "ok") { console.log(`  lookup ${r.kind}\n`); continue }
    const d = r.value.decodedAbort
    console.log(`  digest      ${digest}`)
    console.log(`  raw         ${r.value.error}`)
    console.log(`  cause       ${d?.cause}`)
    console.log(`  package     ${d?.package ?? "-"}`)
    console.log(`  errorName   ${d?.errorName ?? "(none, honest floor)"}`)
    console.log(`  commandKind ${d?.commandKind ?? "-"}  coinOrigin ${d?.coinOrigin ?? "-"}`)
    console.log(`  gas         ${r.value.gasFormatted ?? "-"}`)
    console.log(`  ANSWER      ${d?.reason}\n`)
  }
}

main().catch(e => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
