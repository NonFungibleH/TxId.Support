/**
 * What a user DOES after a transaction fails.
 *
 * WHY THIS EXISTS. The failure count on its own is a weak argument: a 1% abort
 * rate sounds like a rounding error, and users demonstrably do not churn over
 * it. The real cost only appears when you follow the person forward. In the
 * first hand-traced sample of nine Decibel traders, all nine retried the
 * IDENTICAL action, none of them ever succeeded at it, one submitted the same
 * cancel 43 times in 54 seconds and another the same TWAP order 36 times across
 * 36 minutes. Four were cancelling orders already off the book, so no retry
 * could ever have worked, at any point.
 *
 * That is the evidence, and it needs to be reproducible at scale rather than
 * assembled by hand, which is what this does.
 *
 * METHOD. Read the failures the census already cached, group them by sender,
 * then walk each sender forward through the Indexer and ask the fullnode what
 * happened. An "episode" is a run of consecutive attempts at the SAME entry
 * function starting from the failure, and it ends when the user succeeds at it,
 * moves to a different action, or we run out of window. We report which,
 * because "gave up" and "we stopped looking" are different facts and only one
 * of them is a finding.
 *
 * HIGH-VOLUME SENDERS ARE SEPARATED, NOT DELETED. On Decibel one market maker
 * is 85% of non-keeper volume and two thirds of all failures. Folding it in
 * inflates every number; dropping it silently hides that we did. It is reported
 * in its own bucket, with the threshold stated.
 *
 * RATE LIMITS. Same discipline as the census: hard call budget, one backoff
 * then stop, every fetch cached on disk so re-runs cost nothing and an
 * interrupted run is never wasted.
 *
 * Usage:
 *   pnpm --filter @txid/aptos exec tsx scripts/retry-trace.ts
 *   ... --protocol decibel --budget 800 --max-per-wallet 60 --delay 150 --json
 */
import { decodeAbort } from "../src/abort"
import { PROTOCOL_ERRMAPS } from "../src/errmap"
import { normalizeAptosAddress } from "../src/address"
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

function loadKeyFromEnvFile(): void {
  if (process.env.APTOS_API_KEY) return
  let dir = process.cwd()
  for (let up = 0; up < 4; up++) {
    for (const name of [".env.local", ".env"]) {
      const f = join(dir, name)
      if (!existsSync(f)) continue
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
const GQL = process.env.APTOS_INDEXER ?? "https://api.mainnet.aptoslabs.com/v1/graphql"
const HAS_KEY = Boolean(process.env.APTOS_API_KEY)
const CACHE = process.env.CENSUS_CACHE ?? join(process.cwd(), "node_modules", ".cache", "txid-failure-census")

const NAMES: Record<string, string> = {
  "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06": "Decibel",
  "0x111ae3e5bc816a5e63c2da97d0aa3886519e0cd5e4b046659fa35796bd11542a": "Amnis",
  "0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa": "PancakeSwap",
}
const KEEPER = [/::admin_apis::/, /::update_mark/, /::process_[a-z_]*pending_requests/, /::crank/, /::liquidat/]

const argv = process.argv.slice(2)
const arg = (n: string, d?: string) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1]!.startsWith("--") ? argv[i + 1]! : d }
const WANT = (arg("protocol", "decibel")!).toLowerCase()
const BUDGET = Number(arg("budget", HAS_KEY ? "800" : "40"))
const MAX_PER_WALLET = Number(arg("max-per-wallet", "60"))
const DELAY = Number(arg("delay", HAS_KEY ? "150" : "350"))
/** A sender above this share of the protocol's failures is reported separately. */
const BOT_SHARE = Number(arg("bot-share", "0.25"))
const AS_JSON = argv.includes("--json")

let used = 0
let stopped: string | null = null
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function req<T>(url: string, init: RequestInit | undefined, key: string): Promise<T | null> {
  const f = join(CACHE, `${key}.json`)
  if (existsSync(f)) { try { return JSON.parse(readFileSync(f, "utf8")) as T } catch { /* refetch */ } }
  if (stopped) return null
  if (used >= BUDGET) { stopped = `call budget of ${BUDGET} reached`; return null }
  used++
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string>) }
  if (HAS_KEY) headers.Authorization = `Bearer ${process.env.APTOS_API_KEY}`
  for (let a = 0; a < 2; a++) {
    try {
      const res = await fetch(url, { ...init, headers, signal: AbortSignal.timeout(30_000) })
      if (res.status === 429) { if (a === 0) { await sleep(3000); continue } stopped = "rate limited (429)"; return null }
      if (!res.ok) return null
      const body = (await res.json()) as T
      mkdirSync(CACHE, { recursive: true }); writeFileSync(f, JSON.stringify(body))
      await sleep(DELAY)
      return body
    } catch { if (a === 1) return null; await sleep(1000) }
  }
  return null
}

interface RawTx { success?: boolean; vm_status?: string; timestamp?: string; version?: string; sender?: string; gas_used?: string; gas_unit_price?: string; payload?: { function?: string } }

const txAt = (v: string) => req<RawTx>(`${BASE}/transactions/by_version/${v}`, undefined, `v-${v}`)
const after = (addr: string, from: string) => req<{ data?: { account_transactions?: { transaction_version: string }[] } }>(
  GQL,
  { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
    query: `query($a:String!,$v:bigint!,$n:Int!){account_transactions(where:{account_address:{_eq:$a},transaction_version:{_gte:$v}},order_by:{transaction_version:asc},limit:$n){transaction_version}}`,
    variables: { a: addr, v: from, n: MAX_PER_WALLET },
  }) },
  `acct-${addr.slice(2, 14)}-${from}-${MAX_PER_WALLET}`,
)

interface Episode { wallet: string; fn: string; cause: string; attempts: number; failed: number; seconds: number; gasApt: number; ended: "succeeded" | "moved on" | "still failing" | "window ended"; bot: boolean }

async function main() {
  const addresses = [...new Set(Object.keys(PROTOCOL_ERRMAPS).map(k => normalizeAptosAddress(k.split("::")[0]!)))]
  const target = addresses.find(a => (NAMES[a] ?? a).toLowerCase().startsWith(WANT) || a === WANT)
  if (!target) { console.error(`Unknown protocol "${WANT}".`); process.exit(1) }
  const label = NAMES[target] ?? target
  if (!existsSync(CACHE)) { console.error("No census cache. Run failure-census.ts first."); process.exit(1) }

  // Every failure the census already saw, with no extra requests.
  const seen = new Set<string>()
  const failures = new Map<string, { version: string; fn: string; vm: string }[]>()
  for (const f of readdirSync(CACHE).filter(x => x.startsWith("b-"))) {
    let txs: unknown
    try { txs = JSON.parse(readFileSync(join(CACHE, f), "utf8")) } catch { continue }
    if (!Array.isArray(txs)) continue
    for (const t of txs as RawTx[]) {
      if (!t.version || seen.has(t.version)) continue
      seen.add(t.version)
      const fn = t.payload?.function ?? ""
      if (!fn.startsWith(target) || t.success !== false) continue
      if (KEEPER.some(p => p.test(fn))) continue
      const list = failures.get(t.sender!) ?? []
      list.push({ version: t.version, fn: fn.split("::").slice(1).join("::"), vm: t.vm_status ?? "" })
      failures.set(t.sender!, list)
    }
  }
  const total = [...failures.values()].reduce((n, v) => n + v.length, 0)
  if (total === 0) { console.error(`No cached ${label} failures. Run the census with a bigger --budget.`); process.exit(1) }
  const bots = new Set([...failures].filter(([, v]) => v.length / total >= BOT_SHARE).map(([s]) => s))

  console.log(`\n  Tracing ${total} cached ${label} failures from ${failures.size} wallets`)
  if (bots.size) console.log(`  (${bots.size} high-volume sender(s) above ${(BOT_SHARE * 100).toFixed(0)}% of failures reported separately)`)
  console.log()

  const episodes: Episode[] = []
  for (const [wallet, list] of failures) {
    if (stopped) break
    const first = list.reduce((a, b) => (BigInt(a.version) < BigInt(b.version) ? a : b))
    const rows = (await after(wallet, first.version))?.data?.account_transactions ?? []
    if (!rows.length) continue
    let attempts = 0, failed = 0, t0: number | null = null, tEnd = 0, gas = 0
    let ended: Episode["ended"] = "window ended"
    for (const r of rows) {
      if (stopped) break
      const t = await txAt(r.transaction_version)
      if (!t) break
      const fn = (t.payload?.function ?? "").split("::").slice(1).join("::")
      if (fn !== first.fn) { if (attempts) { ended = "moved on"; break } continue }
      attempts++
      const ts = Number(t.timestamp ?? 0)
      if (t0 === null) t0 = ts
      tEnd = ts
      gas += Number(t.gas_used ?? 0) * Number(t.gas_unit_price ?? 0)
      if (t.success === false) failed++
      else { ended = "succeeded"; break }
    }
    if (!attempts) continue
    if (ended === "window ended" && attempts >= rows.length) ended = "still failing"
    const d = decodeAbort(first.vm, PROTOCOL_ERRMAPS)
    episodes.push({ wallet, fn: first.fn, cause: d.errorName ?? d.cause, attempts, failed, seconds: t0 ? (tEnd - t0) / 1e6 : 0, gasApt: gas / 1e8, ended, bot: bots.has(wallet) })
  }

  const human = episodes.filter(e => !e.bot)
  const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)]! : 0 }

  if (AS_JSON) { console.log(JSON.stringify({ protocol: label, episodes, callsUsed: used, stopped }, null, 2)); return }

  console.log(`  ${"wallet".padEnd(17)} ${"action".padEnd(30)} ${"cause".padEnd(24)} ${"try".padStart(4)} ${"fail".padStart(4)} ${"secs".padStart(6)}  outcome`)
  console.log(`  ${"-".repeat(104)}`)
  for (const e of [...episodes].sort((a, b) => b.attempts - a.attempts)) {
    const w = `${e.wallet.slice(0, 15)}…${e.bot ? "*" : " "}`
    console.log(`  ${w.padEnd(17)} ${e.fn.split("::").pop()!.slice(0, 30).padEnd(30)} ${e.cause.slice(0, 24).padEnd(24)} ${String(e.attempts).padStart(4)} ${String(e.failed).padStart(4)} ${e.seconds.toFixed(0).padStart(6)}  ${e.ended}`)
  }
  if (bots.size) console.log(`\n  * high-volume sender, excluded from the figures below`)

  if (!human.length) { console.log("\n  No non-bot episodes traced.\n"); return }
  const neverWorked = human.filter(e => e.ended !== "succeeded")
  console.log(`\n  ACROSS ${human.length} NON-BOT EPISODES`)
  console.log(`    total failed attempts        : ${human.reduce((n, e) => n + e.failed, 0)}`)
  console.log(`    median attempts per episode  : ${med(human.map(e => e.attempts))}`)
  console.log(`    worst                        : ${Math.max(...human.map(e => e.attempts))} attempts over ${Math.max(...human.map(e => e.seconds)).toFixed(0)}s`)
  console.log(`    retried at least once        : ${human.filter(e => e.attempts > 1).length} of ${human.length}`)
  console.log(`    NEVER succeeded at it        : ${neverWorked.length} of ${human.length}`)
  console.log(`    median seconds stuck         : ${med(human.map(e => e.seconds)).toFixed(0)}`)
  console.log(`    gas burned on failed retries : ${human.reduce((n, e) => n + e.gasApt, 0).toFixed(5)} APT`)
  const byCause = new Map<string, number>()
  for (const e of human) byCause.set(e.cause, (byCause.get(e.cause) ?? 0) + e.failed)
  console.log(`\n  failed attempts by cause:`)
  for (const [c, n] of [...byCause].sort((a, b) => b[1] - a[1])) console.log(`    ${String(n).padStart(4)}  ${c}`)
  console.log(`\n  calls used: ${used} of ${BUDGET}${stopped ? `  (stopped: ${stopped})` : ""}\n`)
}

main().catch(e => { console.error(e); process.exit(1) })
