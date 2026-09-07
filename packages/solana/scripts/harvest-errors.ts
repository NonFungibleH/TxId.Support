/**
 * Build the Solana error map from the chain, not from guesswork.
 *
 * On Aptos we harvest error names from Move source published to the on-chain
 * PackageRegistry. Solana has no equivalent: both public Anchor IDL registries
 * are dead, and the on-chain IDL account needs PDA derivation we do not have.
 *
 * But Anchor programs PRINT the answer when they fail:
 *
 *   Program log: AnchorError thrown in programs/pump-amm/src/…/sell.rs:170.
 *   Error Code: ExceededSlippage. Error Number: 6004. Error Message: ExceededSlippage.
 *
 * That is the program's own name and message for its own code. Sampling enough
 * live failures therefore HARVESTS the map, exactly as reading source does on
 * Aptos, and every pair is observed rather than asserted. A program that emits
 * the log even occasionally gets mapped permanently, which then covers the
 * times it does not.
 *
 * Also counts (program, code) pairs seen WITHOUT a name, because that ranked
 * list is the to-do: the codes users hit most that nobody can explain.
 *
 * Usage: tsx scripts/harvest-errors.ts [--slots 40] [--delay 400] [--out errmap.json]
 */
import { writeFileSync, existsSync, readFileSync } from "node:fs"

const RPC = process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com"
const argv = process.argv.slice(2)
const arg = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1]! : d }
const SLOTS = Number(arg("slots", "40"))
const DELAY = Number(arg("delay", "400"))
const OUT = arg("out", "scripts/harvested-errors.json")

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  for (let a = 0; a < 3; a++) {
    try {
      const res = await fetch(RPC, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(45_000),
      })
      // The public endpoint answers 429 under load. Back off rather than
      // hammering it: this is somebody else's free infrastructure.
      if (res.status === 429) { await sleep(2000 * (a + 1)); continue }
      if (!res.ok) return null
      return ((await res.json()) as { result?: unknown }).result ?? null
    } catch { await sleep(1000) }
  }
  return null
}

interface Observed { program: string; code: number; name: string; message: string; seen: number }

function failingProgram(logs: string[]): string | null {
  for (let i = logs.length - 1; i >= 0; i--) {
    const m = /^Program (\S+) failed:/.exec(logs[i] ?? "")
    if (m?.[1]) return m[1]
  }
  return null
}

async function main() {
  const named = new Map<string, Observed>()
  const unnamed = new Map<string, { program: string; code: number; seen: number }>()
  let slotsRead = 0, txs = 0, failed = 0

  const tip = (await rpc("getSlot", [])) as number | null
  if (typeof tip !== "number") { console.error("Could not reach the RPC."); process.exit(1) }

  for (let i = 0; i < SLOTS; i++) {
    const block = (await rpc("getBlock", [tip - 60 - i * 3, {
      encoding: "json", maxSupportedTransactionVersion: 0, transactionDetails: "full", rewards: false,
    }])) as { transactions?: { meta?: { err?: unknown; logMessages?: string[] } }[] } | null
    await sleep(DELAY)
    if (!block?.transactions) continue
    slotsRead++
    for (const t of block.transactions) {
      txs++
      const err = t.meta?.err
      if (!err) continue
      failed++
      const logs = t.meta?.logMessages ?? []
      const program = failingProgram(logs)
      const custom = (err as { InstructionError?: [number, { Custom?: number }] }).InstructionError?.[1]?.Custom
      if (typeof custom !== "number" || !program) continue

      // Anchor's own words, when it printed them.
      const line = logs.find(l => /Error Number: \d+\./.test(l))
      const nameM = line ? /Error Code: ([A-Za-z0-9_]+)\./.exec(line) : null
      const numM = line ? /Error Number: (\d+)\./.exec(line) : null
      const msgM = line ? /Error Message: (.+?)\.?$/.exec(line) : null

      if (nameM?.[1] && numM?.[1] && Number(numM[1]) === custom) {
        const key = `${program}:${custom}`
        const prev = named.get(key)
        if (prev) prev.seen++
        else named.set(key, { program, code: custom, name: nameM[1], message: (msgM?.[1] ?? nameM[1]).trim(), seen: 1 })
      } else {
        const key = `${program}:${custom}`
        const prev = unnamed.get(key)
        if (prev) prev.seen++
        else unnamed.set(key, { program, code: custom, seen: 1 })
      }
    }
    if ((i + 1) % 10 === 0) process.stdout.write(`  ${i + 1}/${SLOTS} slots, ${named.size} named, ${unnamed.size} unnamed\n`)
  }

  // Merge with anything harvested previously: runs accumulate, and a program
  // that printed its name once should stay mapped even if later runs miss it.
  let prior: { named?: Observed[]; unnamed?: { program: string; code: number; seen: number }[] } = {}
  if (existsSync(OUT)) { try { prior = JSON.parse(readFileSync(OUT, "utf8")) } catch { /* start fresh */ } }
  for (const p of prior.named ?? []) {
    const k = `${p.program}:${p.code}`
    const cur = named.get(k)
    if (cur) cur.seen += p.seen
    else named.set(k, p)
  }
  for (const p of prior.unnamed ?? []) {
    const k = `${p.program}:${p.code}`
    if (named.has(k)) continue
    const cur = unnamed.get(k)
    if (cur) cur.seen += p.seen
    else unnamed.set(k, p)
  }
  for (const k of named.keys()) unnamed.delete(k)

  const namedArr = [...named.values()].sort((a, b) => b.seen - a.seen)
  const unnamedArr = [...unnamed.values()].sort((a, b) => b.seen - a.seen)
  writeFileSync(OUT, JSON.stringify({ named: namedArr, unnamed: unnamedArr }, null, 2))

  console.log(`\n  slots read ${slotsRead}, transactions ${txs.toLocaleString()}, failures ${failed}`)
  console.log(`  failure rate ${(failed / Math.max(txs, 1) * 100).toFixed(1)}%\n`)
  console.log(`HARVESTED (program named its own error): ${namedArr.length}`)
  for (const o of namedArr.slice(0, 20)) console.log(`  ${String(o.seen).padStart(4)}  ${o.code}  ${o.name.padEnd(30)} ${o.program.slice(0, 12)}…`)
  console.log(`\nSEEN BUT UNNAMED (the to-do, ranked by how often users hit it): ${unnamedArr.length}`)
  for (const o of unnamedArr.slice(0, 15)) console.log(`  ${String(o.seen).padStart(4)}  ${String(o.code).padEnd(6)} ${o.program}`)
  console.log(`\n  written to ${OUT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
