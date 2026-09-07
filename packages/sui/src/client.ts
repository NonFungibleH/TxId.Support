import { decodeSuiAbort, type DecodedSuiAbort, type SuiErrmap } from "./abort"
import { resolveOriginalPackage } from "./package"
import { rpc } from "./rpc"
import type { SuiBalance, SuiCoinBalance, SuiLookup, SuiTransaction } from "./types"

const MIST = 1_000_000_000n

function formatMist(raw: bigint, dp = 4): string {
  const neg = raw < 0n
  const v = neg ? -raw : raw
  const whole = v / MIST
  const frac = (v % MIST).toString().padStart(9, "0").slice(0, dp).replace(/0+$/, "")
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}${frac ? "." + frac : ""}`
}

/** A coin type's last segment. A LABEL, not a verified symbol: anyone can publish a type called USDC. */
const symbolOf = (coinType: string) => coinType.split("::").pop() ?? coinType

/**
 * What the transaction actually cost, which on Sui can be LESS THAN NOTHING.
 *
 * Net gas is computation + storage, less the storage rebate, and a transaction
 * that frees more storage than it takes gets back more than it paid. Observed
 * live on 2026-09-07: a failed transaction with a net of -0.0008 SUI. Rendering
 * that as "-0.0008 SUI" of gas alongside "only the gas was spent" is a sentence
 * that cannot be true, so the negative case says what actually happened to the
 * balance instead of printing a minus sign at a worried user.
 */
function gasSummary(g: RawEffects["gasUsed"]): { gasUsed: string | null; gasFormatted: string | null } {
  if (!g) return { gasUsed: null, gasFormatted: null }
  let net: bigint
  try {
    net = BigInt(g.computationCost ?? "0") + BigInt(g.storageCost ?? "0") - BigInt(g.storageRebate ?? "0")
  } catch {
    return { gasUsed: null, gasFormatted: null }
  }
  if (net < 0n) {
    return { gasUsed: net.toString(), gasFormatted: `${formatMist(-net)} SUI returned, because the storage rebate came to more than the cost` }
  }
  return { gasUsed: net.toString(), gasFormatted: `${formatMist(net)} SUI` }
}

interface RawEffects {
  status?: { status?: string; error?: string }
  gasUsed?: { computationCost?: string; storageCost?: string; storageRebate?: string }
}

interface RawTx {
  digest?: string
  timestampMs?: string
  checkpoint?: string
  effects?: RawEffects
  transaction?: { data?: { sender?: string; transaction?: { transactions?: unknown[] } } }
}

/** The programmable transaction's own command list, from `showInput`. Undefined means NOT READ. */
const commandsOf = (r: RawTx): unknown[] | undefined => {
  const cmds = r.transaction?.data?.transaction?.transactions
  return Array.isArray(cmds) ? cmds : undefined
}

/**
 * Decode, and pay for a package-origin lookup only when it could change the
 * answer: there is a map to consult, the first pass found nothing in it, and
 * the abort names a package and module. A Sui upgrade republishes at a new
 * address, so the runtime address in the abort is not a stable key (see
 * package.ts). Resolution is cached process-wide, so a list of failures from
 * one protocol costs one call.
 */
async function decodeWithOrigin(
  error: string,
  errmap: SuiErrmap | undefined,
  commands: unknown[] | undefined,
  budget: { left: number },
): Promise<DecodedSuiAbort> {
  const first = decodeSuiAbort(error, errmap, { commands })
  if (!errmap || first.errorName || first.cause !== "move_abort") return first
  if (!first.package || !first.module || budget.left <= 0) return first

  budget.left -= 1
  const origin = await resolveOriginalPackage(first.package, first.module)
  if (origin.kind !== "ok" || origin.original === first.package) return first
  return decodeSuiAbort(error, errmap, { commands, originalPackage: origin.original })
}

export async function getSuiTransaction(digest: string, errmap?: SuiErrmap): Promise<SuiLookup<SuiTransaction>> {
  const d = digest.trim()
  // Sui digests are base58, 43 or 44 characters. Rejecting here keeps a typo
  // from being reported as "the network could not be reached".
  if (!/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(d)) {
    return { kind: "unavailable", reason: "that is not a Sui transaction digest" }
  }
  const out = await rpc("sui_getTransactionBlock", [d, { showEffects: true, showInput: true }])
  if (!out.ok) {
    // The node saying it has never seen this digest IS an answer, and the only
    // signal we get is the message. Anything else is a failure to ask.
    if (/could not find|not\s*found|does not exist/i.test(out.reason)) return { kind: "not_found" }
    return { kind: "unavailable", reason: out.reason }
  }
  const r = out.result as RawTx | null
  if (!r || typeof r !== "object") return { kind: "not_found" }

  const eff = r.effects ?? {}
  const failed = eff.status?.status === "failure"
  const error = failed ? (eff.status?.error ?? null) : null
  const gas = gasSummary(eff.gasUsed)

  const tx: SuiTransaction = {
    digest: r.digest ?? d,
    timestampMs: r.timestampMs ? Number(r.timestampMs) : null,
    checkpoint: r.checkpoint ?? null,
    sender: r.transaction?.data?.sender ?? null,
    status: failed ? "failed" : "success",
    gasUsed: gas.gasUsed,
    gasFormatted: gas.gasFormatted,
    error,
    ...(error ? { decodedAbort: await decodeWithOrigin(error, errmap, commandsOf(r), { left: 1 }) } : {}),
  }
  return { kind: "ok", value: tx }
}

export async function getSuiBalance(owner: string): Promise<SuiLookup<SuiBalance>> {
  const a = owner.trim().toLowerCase()
  if (!/^0x[0-9a-f]{1,64}$/.test(a)) return { kind: "unavailable", reason: "that is not a Sui address" }
  const out = await rpc("suix_getAllBalances", [a])
  if (!out.ok) return { kind: "unavailable", reason: out.reason }
  const rows = out.result as { coinType?: string; totalBalance?: string }[] | null
  // An empty list is a REAL answer: this address holds nothing. It is not the
  // same as a failed read, and only the tri-state above can tell them apart.
  if (!Array.isArray(rows)) return { kind: "unavailable", reason: "unexpected response shape" }

  let suiRaw = 0n
  const coins: SuiCoinBalance[] = []
  for (const row of rows) {
    const type = row.coinType ?? ""
    let raw = 0n
    try { raw = BigInt(row.totalBalance ?? "0") } catch { continue }
    if (raw === 0n) continue
    if (type === "0x2::sui::SUI" || type.endsWith("::sui::SUI")) {
      suiRaw = raw
      continue
    }
    coins.push({
      coinType: type,
      symbol: symbolOf(type),
      amountRaw: raw.toString(),
      // Decimals live on the coin's metadata object, a separate call per type.
      // We do not guess: null means NOT READ, never zero, and callers must not
      // format an amount as if they knew the scale.
      decimals: null,
      amount: raw.toString(),
    })
  }
  return { kind: "ok", value: { sui: formatMist(suiRaw), suiRaw: suiRaw.toString(), coins } }
}

export async function getSuiRecentTransactions(owner: string, limit = 10, errmap?: SuiErrmap): Promise<SuiLookup<SuiTransaction[]>> {
  const a = owner.trim().toLowerCase()
  if (!/^0x[0-9a-f]{1,64}$/.test(a)) return { kind: "unavailable", reason: "that is not a Sui address" }
  const out = await rpc("suix_queryTransactionBlocks", [
    { filter: { FromAddress: a }, options: { showEffects: true, showInput: true } },
    null, Math.min(Math.max(limit, 1), 50), true,
  ])
  if (!out.ok) return { kind: "unavailable", reason: out.reason }
  const page = out.result as { data?: unknown[] } | null
  if (!page || !Array.isArray(page.data)) return { kind: "unavailable", reason: "unexpected response shape" }

  const txs: SuiTransaction[] = []
  // A list can hold failures from many packages. Cache hits are free, so this
  // caps only the calls that would actually go out on a cold process.
  const budget = { left: 5 }
  for (const raw of page.data) {
    const r = raw as RawTx
    const eff = r.effects ?? {}
    const failed = eff.status?.status === "failure"
    const error = failed ? (eff.status?.error ?? null) : null
    const gas = gasSummary(eff.gasUsed)
    txs.push({
      digest: r.digest ?? "",
      timestampMs: r.timestampMs ? Number(r.timestampMs) : null,
      checkpoint: r.checkpoint ?? null,
      sender: r.transaction?.data?.sender ?? a,
      status: failed ? "failed" : "success",
      gasUsed: gas.gasUsed,
      gasFormatted: gas.gasFormatted,
      error,
      ...(error ? { decodedAbort: await decodeWithOrigin(error, errmap, commandsOf(r), budget) } : {}),
    })
  }
  return { kind: "ok", value: txs }
}
