/**
 * How many transactions fail on an Aptos protocol, and WHY.
 *
 * WHY THIS EXISTS. "X transactions failed on Decibel today" is a number anyone
 * with an indexer can produce. The number only we can produce is the same count
 * broken down by CAUSE in plain English, because that needs the abort decoder
 * and the protocol error maps. This script produces the second one.
 *
 * WHY IT SAMPLES INSTEAD OF COUNTING. There is no query that answers this.
 * The Indexer's `user_transactions` can filter by contract
 * (`entry_function_contract_address`) but carries NO success field, exposes no
 * aggregates, and caps pages at 100 rows. The fullnode knows `success` and
 * `vm_status` but can only be read by version range, never by contract. So the
 * only complete answer is walking every version in the window, and Decibel
 * alone runs ~11M transactions a day. We sample evenly across the window and
 * extrapolate, and we say so in the output rather than presenting an estimate
 * as a count.
 *
 * RATE LIMITS ARE THE BINDING CONSTRAINT, NOT TIME. The anonymous tier dies
 * after roughly seven calls (this is what capped tune-diagnosis.ts too). So:
 * every request is serial and delayed, there is a HARD call budget that the run
 * cannot exceed, a 429 backs off and then stops the run cleanly rather than
 * retrying into the limiter, and every batch is cached on disk so a second run
 * over the same window costs nothing. Without APTOS_API_KEY the default budget
 * drops to 6 calls, which is below where the anonymous tier fails.
 *
 * Usage:
 *   pnpm --filter @txid/aptos exec tsx scripts/failure-census.ts --protocol decibel
 *   ... --hours 24 --budget 120 --delay 300 --all-functions --json
 */
import { decodeAbort } from "../src/abort"
import { PROTOCOL_ERRMAPS } from "../src/errmap"
import { normalizeAptosAddress } from "../src/address"
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Load APTOS_API_KEY from a local env file if the shell does not carry it.
 * WHY: `vercel env pull` writes the key to .env.local at the repo root, but tsx
 * does not read env files. Without this the script silently falls back to the
 * 6-call anonymous budget and reports a uselessly small sample as though it
 * were a real one, which is the same failure shape the codebase exists to
 * avoid: a missing input must not look like a completed one.
 */
function loadKeyFromEnvFile(): void {
  if (process.env.APTOS_API_KEY) return
  let dir = process.cwd()
  for (let up = 0; up < 4; up++) {
    for (const name of [".env.local", ".env"]) {
      const f = join(dir, name)
      if (!existsSync(f)) continue
      // Take the LAST NON-EMPTY match, not the first match. `vercel env pull`
      // writes sensitive variables back as APTOS_API_KEY="" because Vercel
      // cannot decrypt them, so the first match is usually an empty decoy and
      // a key appended below it would never be seen.
      const val = readFileSync(f, "utf8").split("\n")
        .filter(l => l.trim().startsWith("APTOS_API_KEY="))
        .map(l => l.trim().slice("APTOS_API_KEY=".length).trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean).pop()
      if (val) { process.env.APTOS_API_KEY = val; console.log(`  using APTOS_API_KEY from ${f}`); return }
    }
    dir = join(dir, "..")
  }
}
loadKeyFromEnvFile()

const BASE = process.env.APTOS_FULLNODE ?? "https://api.mainnet.aptoslabs.com/v1"
const HAS_KEY = Boolean(process.env.APTOS_API_KEY)
const CACHE_DIR = process.env.CENSUS_CACHE ?? join(process.cwd(), "node_modules", ".cache", "txid-failure-census")

/** Friendly names for the addresses we hold error maps for. */
const NAMES: Record<string, string> = {
  "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06": "Decibel",
  "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a": "Amnis",
  "0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa": "PancakeSwap",
  "0x48271d39d0b05bd6efca2278f22277d6fcc375504f9839fd73f74ace240861af": "Thala v1",
  "0x007730cd28ee1cdc9e999336cbc430f99e7c44397c0aa77516f6f23a78559bb5": "Thala v2",
  "0x9770fa9c725cbd97eb50b2be5f7416efdfd1f1554beb0750d4dae4c64e860da3": "Aries",
}

/**
 * Bots, not people. A support inbox never sees an oracle mark update or a
 * matching-engine sweep, so counting them buries the failures that matter:
 * on Decibel they are roughly 58% of all volume. Pass --all-functions to
 * include them.
 */
const KEEPER_PATTERNS = [/::admin_apis::/, /::update_mark/, /::process_[a-z_]*pending_requests/, /::crank/, /::liquidat/]

interface RawTx {
  type?: string
  success?: boolean
  vm_status?: string
  timestamp?: string
  version?: string
  payload?: { function?: string }
}

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2)
const arg = (name: string, fallback?: string): string | undefined => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1] : fallback
}
const flag = (name: string) => argv.includes(`--${name}`)

const HOURS = Number(arg("hours", "24"))
const DELAY_MS = Number(arg("delay", "300"))
const BUDGET = Number(arg("budget", HAS_KEY ? "120" : "6"))
const WANT = (arg("protocol", "decibel") ?? "decibel").toLowerCase()
const ALL_FUNCTIONS = flag("all-functions")
const AS_JSON = flag("json")

// ------------------------------------------------------------- http, gently
let callsUsed = 0
let stoppedEarly: string | null = null
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

/**
 * One request, against a hard budget. A 429 backs off once and then STOPS the
 * run: retrying into a limiter is how you lose the key for everything else that
 * is using it, and a partial sample we can describe honestly beats a full one
 * we had to fight for.
 */
async function get<T>(path: string, cacheKey?: string): Promise<T | null> {
  if (cacheKey) {
    const f = join(CACHE_DIR, `${cacheKey}.json`)
    if (existsSync(f)) {
      try { return JSON.parse(readFileSync(f, "utf8")) as T } catch { /* fall through and refetch */ }
    }
  }
  if (stoppedEarly) return null
  if (callsUsed >= BUDGET) { stoppedEarly = `call budget of ${BUDGET} reached`; return null }
  callsUsed++
  const headers = HAS_KEY ? { Authorization: `Bearer ${process.env.APTOS_API_KEY}` } : undefined
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Conditional spread, not `{ headers }`: exactOptionalPropertyTypes
      // rejects an explicit undefined, which is the house rule.
      const res = await fetch(`${BASE}${path}`, {
        ...(headers ? { headers } : {}),
        signal: AbortSignal.timeout(30_000),
      })
      if (res.status === 429) {
        if (attempt === 0) { await sleep(3000); continue }
        stoppedEarly = "rate limited (429)"
        return null
      }
      if (!res.ok) return null
      const body = (await res.json()) as T
      if (cacheKey) {
        mkdirSync(CACHE_DIR, { recursive: true })
        writeFileSync(join(CACHE_DIR, `${cacheKey}.json`), JSON.stringify(body))
      }
      await sleep(DELAY_MS)
      return body
    } catch {
      if (attempt === 1) return null
      await sleep(1000)
    }
  }
  return null
}

/**
 * The ledger version that was current `hours` ago. Aptos versions increment per
 * transaction, not per second, so the throughput is measured rather than
 * assumed: probe, compute the real versions-per-second, jump, probe once more.
 * Two calls, and it converges because throughput is steady over hours.
 */
async function versionHoursAgo(nowV: bigint, nowSec: number, hours: number): Promise<bigint | null> {
  const targetSec = nowSec - hours * 3600
  let probe = nowV - 1_000_000n
  for (let i = 0; i < 3; i++) {
    const tx = await get<RawTx>(`/transactions/by_version/${probe}`, `probe-${probe}`)
    const ts = tx?.timestamp ? Number(tx.timestamp) / 1e6 : null
    if (ts === null) return null
    const elapsed = nowSec - ts
    if (elapsed <= 0) { probe = probe - 1_000_000n; continue }
    const perSec = Number(nowV - probe) / elapsed
    const want = nowV - BigInt(Math.round(perSec * hours * 3600))
    if (Math.abs(ts - targetSec) < 900) return probe          // within 15 minutes, good enough
    probe = want > 0n ? want : 1n
  }
  return probe > 0n ? probe : null
}

// ------------------------------------------------------------------- census
async function main() {
  const addresses = [...new Set(Object.keys(PROTOCOL_ERRMAPS).map(k => normalizeAptosAddress(k.split("::")[0]!)))]
  const target = addresses.find(a => (NAMES[a] ?? a).toLowerCase().startsWith(WANT) || a === WANT)
  if (!target) {
    console.error(`Unknown protocol "${WANT}". Mapped protocols: ${addresses.map(a => NAMES[a] ?? a).join(", ")}`)
    process.exit(1)
  }
  const label = NAMES[target] ?? target

  if (!HAS_KEY) {
    console.warn(`\n  APTOS_API_KEY is not set, so the budget is capped at ${BUDGET} calls (the anonymous tier`)
    console.warn(`  fails at about seven). Set the key for a sample large enough to mean anything.\n`)
  }

  // ANCHOR THE WINDOW TO THE TOP OF THE HOUR, NOT TO "NOW". Anchoring to now
  // moves every batch boundary on every run, so no cached batch is ever reused
  // and a second look at the same day costs a second full budget. On the hour,
  // the window is identical for every run within that hour: the batches come
  // straight from disk, and the number you quote is reproducible.
  const hourBucket = Math.floor(Date.now() / 3_600_000)
  const windowKey = `window-${hourBucket}-${HOURS}h`
  let fromV: bigint, toV: bigint
  const cachedWindow = await (async () => {
    const f = join(CACHE_DIR, `${windowKey}.json`)
    if (!existsSync(f)) return null
    try { return JSON.parse(readFileSync(f, "utf8")) as { from: string; to: string } } catch { return null }
  })()
  if (cachedWindow) {
    fromV = BigInt(cachedWindow.from); toV = BigInt(cachedWindow.to)
  } else {
    const info = await get<{ ledger_version: string; ledger_timestamp: string }>("/")
    if (!info) { console.error("Could not read the fullnode."); process.exit(1) }
    const nowV = BigInt(info.ledger_version)
    const nowSec = Number(info.ledger_timestamp) / 1e6
    const endSec = hourBucket * 3600
    const end = await versionHoursAgo(nowV, nowSec, (nowSec - endSec) / 3600)
    toV = end ?? nowV
    const start = await versionHoursAgo(nowV, nowSec, (nowSec - endSec) / 3600 + HOURS)
    if (start === null) { console.error("Could not locate the start of the window."); process.exit(1) }
    fromV = start
    mkdirSync(CACHE_DIR, { recursive: true })
    writeFileSync(join(CACHE_DIR, `${windowKey}.json`), JSON.stringify({ from: fromV.toString(), to: toV.toString() }))
  }
  const span = toV - fromV

  // A FIXED SAMPLE GRID, VISITED IN A SPREAD ORDER. The grid is always 256
  // slots across the window regardless of how much budget is left, so a slot's
  // start version is the same on every run and cached batches are actually
  // reused: a bigger budget ADDS to the sample rather than re-fetching it.
  // Slots are visited in bit-reversed order (0, 128, 64, 192, ...) so that
  // stopping early, whether on budget or on a 429, still leaves the sample
  // spread evenly across the whole window instead of bunched at its start.
  // 4096 slots, not 256. The grid is deliberately far larger than any single
  // run will use: the visit order is bit-reversed, so a run that stops early
  // still covers the window evenly, and a LATER run with more budget continues
  // into slots the first one never reached instead of re-fetching. A smaller
  // grid silently caps the sample — the first 2000-call run only spent 206,
  // because 256 batches was everything the grid could offer.
  const SLOTS = 4096
  const step = span / BigInt(SLOTS)
  const spreadOrder = Array.from({ length: SLOTS }, (_, i) => {
    let r = 0
    for (let b = 0; b < 12; b++) r = (r << 1) | ((i >> b) & 1)
    return r
  })

  let sampledTx = 0, protoTx = 0, keeperTx = 0, userTx = 0, userFails = 0
  const causes = new Map<string, { count: number; reason: string; fn: string }>()
  const examples: { fn: string; status: string }[] = []

  let batchesRead = 0
  for (const slot of spreadOrder) {
    if (stoppedEarly) break
    const start = fromV + step * BigInt(slot)
    const page = await get<RawTx[]>(`/transactions?start=${start}&limit=100`, `b-${start}`)
    if (!Array.isArray(page)) break
    batchesRead++
    for (const tx of page) {
      if (tx.type !== "user_transaction") continue
      sampledTx++
      const fn = tx.payload?.function ?? ""
      if (!fn.startsWith("0x") || normalizeAptosAddress(fn.split("::")[0]!) !== target) continue
      protoTx++
      const isKeeper = KEEPER_PATTERNS.some(p => p.test(fn))
      if (isKeeper && !ALL_FUNCTIONS) { keeperTx++; continue }
      userTx++
      if (tx.success !== false) continue
      userFails++
      const short = fn.split("::").slice(1).join("::")
      const d = decodeAbort(tx.vm_status ?? "", PROTOCOL_ERRMAPS)
      const key = d.errorName ?? `${d.cause}:${d.code ?? "?"}`
      const prev = causes.get(key)
      if (prev) prev.count++
      else causes.set(key, { count: 1, reason: d.reason, fn: short })
      if (examples.length < 3) examples.push({ fn: short, status: (tx.vm_status ?? "").slice(0, 110) })
    }
  }

  // ------------------------------------------------------------------ report
  const shareOfLedger = sampledTx > 0 ? protoTx / sampledTx : 0
  // Protocol transactions per sampled version, applied across the window.
  const sampledVersions = batchesRead * 100
  const perVersion = sampledVersions > 0 ? protoTx / sampledVersions : 0
  const estProto = Math.round(Number(span) * perVersion)
  const userShare = protoTx > 0 ? userTx / protoTx : 0
  const estUser = Math.round(estProto * userShare)
  const rate = userTx > 0 ? userFails / userTx : null

  if (AS_JSON) {
    console.log(JSON.stringify({
      protocol: label, address: target, hours: HOURS,
      window: { fromVersion: fromV.toString(), toVersion: toV.toString(), versions: span.toString() },
      sampled: { versions: sampledVersions, userTransactions: sampledTx, protocol: protoTx, keepers: keeperTx, userFacing: userTx, failures: userFails },
      failureRate: rate, estimatedProtocolTx: estProto, estimatedUserFacingTx: estUser,
      estimatedFailures: rate === null ? null : Math.round(estUser * rate),
      causes: [...causes.entries()].map(([name, c]) => ({ name, count: c.count, share: c.count / Math.max(userFails, 1), reason: c.reason, function: c.fn })).sort((a, b) => b.count - a.count),
      callsUsed, stoppedEarly,
    }, null, 2))
    return
  }

  const pct = (n: number) => `${(n * 100).toFixed(1)}%`
  console.log(`\n  ${label} failure census, last ${HOURS}h`)
  console.log(`  ${"-".repeat(58)}`)
  console.log(`  sampled          ${sampledVersions.toLocaleString()} versions, ${sampledTx.toLocaleString()} user transactions`)
  console.log(`  ${label} share   ${pct(shareOfLedger)} of sampled user transactions`)
  console.log(`  of those         ${keeperTx.toLocaleString()} keeper/oracle, ${userTx.toLocaleString()} user-facing${ALL_FUNCTIONS ? " (keepers included)" : ""}`)
  console.log(`  calls used       ${callsUsed} of ${BUDGET}${stoppedEarly ? `  (stopped: ${stoppedEarly})` : ""}`)
  console.log()

  if (userTx === 0) {
    console.log(`  No user-facing ${label} transactions in the sample. Widen --hours or raise --budget.\n`)
    return
  }

  if (userFails === 0) {
    // An absence is not a zero. Rule of three: with 0 events in n trials the
    // 95% upper bound on the rate is about 3/n. Say the bound, never "0%".
    const bound = 3 / userTx
    console.log(`  No failures in ${userTx.toLocaleString()} sampled user-facing transactions.`)
    console.log(`  That is not a rate of zero, it is a rate below ~${pct(bound)} at 95% confidence.`)
    console.log(`  Estimated ${label} user-facing volume in the window: ~${estUser.toLocaleString()}`)
    console.log(`  So the true daily failure count is somewhere under ~${Math.round(estUser * bound).toLocaleString()}.`)
    console.log(`  Raise --budget for a tighter bound.\n`)
    return
  }

  console.log(`  failures         ${userFails} in ${userTx.toLocaleString()} sampled  (${pct(rate!)})`)
  console.log(`  estimated volume ~${estUser.toLocaleString()} user-facing transactions in the window`)
  console.log(`  ESTIMATED FAILS  ~${Math.round(estUser * rate!).toLocaleString()} in the last ${HOURS}h`)
  console.log(`\n  by cause:`)
  for (const [name, c] of [...causes.entries()].sort((a, b) => b[1].count - a[1].count)) {
    console.log(`\n   ${String(c.count).padStart(3)}  ${name}   (${pct(c.count / userFails)}, ${c.fn})`)
    console.log(`        ${c.reason.slice(0, 150)}${c.reason.length > 150 ? "..." : ""}`)
  }
  console.log(`\n  Extrapolated from a sample, not a count. See the header for why.\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
