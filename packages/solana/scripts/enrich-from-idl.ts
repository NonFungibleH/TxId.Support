/**
 * Close the loop: the harvest finds WHICH codes users hit, the on-chain IDL
 * says what they MEAN.
 *
 * Harvesting alone tops out around 10% of Solana failures, because it only ever
 * finds programs that already print their errors, and the programs users hit
 * hardest stay silent. This reads the ranked "seen but never named" list from
 * the harvest, pulls each program's IDL off the chain, and merges the
 * definitions in. Jupiter's 6001, 624 occurrences and unreachable by sampling,
 * is one `getAccountInfo` away.
 *
 * Doing it here rather than at request time is deliberate: production then does
 * no extra work, has no runtime RPC dependency for error text, and the map
 * stays reviewable in a diff.
 *
 * Usage: tsx scripts/enrich-from-idl.ts [--top 40] [--delay 400]
 */
import { readFileSync, writeFileSync } from "node:fs"
import { fetchIdl } from "../src/idl"

interface Named { program: string; code: number; name: string; message: string; seen: number }
interface Unnamed { program: string; code: number; seen: number }

const argv = process.argv.slice(2)
const arg = (n: string, d: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1]! : d }
const TOP = Number(arg("top", "40"))
const DELAY = Number(arg("delay", "400"))
const FILE = "scripts/harvested-errors.json"

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function main() {
  const data = JSON.parse(readFileSync(FILE, "utf8")) as { named: Named[]; unnamed: Unnamed[] }
  const have = new Set(data.named.map(n => `${n.program}:${n.code}`))

  // One IDL fetch covers every unnamed code for that program, so work per
  // PROGRAM, ranked by how much failure it accounts for.
  const weight = new Map<string, number>()
  for (const u of data.unnamed) weight.set(u.program, (weight.get(u.program) ?? 0) + u.seen)
  const programs = [...weight.entries()].sort((a, b) => b[1] - a[1]).slice(0, TOP)

  let published = 0, none = 0, failed = 0, added = 0, resolved = 0
  for (const [program, seen] of programs) {
    const r = await fetchIdl(program)
    await sleep(DELAY)
    if (r.kind === "unavailable") { failed++; console.log(`  ${String(seen).padStart(5)}  ${program.slice(0, 20)}…  unavailable: ${r.reason}`); continue }
    if (r.kind === "not_published") { none++; console.log(`  ${String(seen).padStart(5)}  ${program.slice(0, 20)}…  no IDL published`); continue }
    published++
    let hits = 0
    for (const e of r.errors) {
      const key = `${program}:${e.code}`
      if (have.has(key)) continue
      have.add(key)
      // seen defaults to 0: these were not observed being printed, they were
      // read from the program's own interface. Frequency comes from the
      // unnamed list where we have it, so ordering stays honest.
      const observed = data.unnamed.find(u => u.program === program && u.code === e.code)?.seen ?? 0
      data.named.push({ program, code: e.code, name: e.name, message: e.msg ?? e.name, seen: observed })
      added++
      if (observed > 0) { hits++; resolved += observed }
    }
    console.log(`  ${String(seen).padStart(5)}  ${program.slice(0, 20)}…  ${r.errors.length} definitions, ${hits} of them codes users actually hit`)
  }

  data.unnamed = data.unnamed.filter(u => !have.has(`${u.program}:${u.code}`))
  data.named.sort((a, b) => b.seen - a.seen)
  writeFileSync(FILE, JSON.stringify(data, null, 2))

  console.log(`\n  programs checked ${programs.length}: ${published} published an IDL, ${none} did not, ${failed} unreachable`)
  console.log(`  definitions added ${added}`)
  console.log(`  FAILURE OCCURRENCES NOW EXPLAINED that harvesting could never reach: ${resolved.toLocaleString()}`)
  console.log(`\n  now run: tsx scripts/build-errmap.ts`)
}

main().catch(e => { console.error(e); process.exit(1) })
