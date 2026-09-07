import { decodeSuiAbort, type SuiErrmap } from "./abort"
import type { SuiBalance, SuiCoinBalance, SuiLookup, SuiTransaction } from "./types"

/**
 * Reading Sui, which is harder than it should be.
 *
 * SUI'S OWN PUBLIC FULLNODE NO LONGER SERVES JSON-RPC. Every method returns
 * "JSON-RPC on public fullnodes has been deprecated" (verified 2026-09-07,
 * every method tried, not just one). Mysten points at gRPC and GraphQL through
 * commercial providers. Two third-party endpoints still serve the JSON-RPC
 * keyless, one of them PublicNode, which our Ethereum and Polygon defaults
 * already use.
 *
 * So this rides on somebody else's infrastructure by necessity, not by choice.
 * That is exactly the arrangement that rotted on Ethereum (cloudflare-eth
 * decommissioned) and Polygon ("tenant disabled"), so: more than one endpoint,
 * tried in order, and SUI_RPC_URLS overrides the list without a deploy.
 */
const DEFAULT_ENDPOINTS = [
  "https://sui-rpc.publicnode.com",
  "https://rpc-mainnet.suiscan.xyz",
]

function endpoints(): string[] {
  const raw = process.env.SUI_RPC_URLS
  if (!raw) return DEFAULT_ENDPOINTS
  const list = raw.split(",").map(s => s.trim()).filter(s => /^https?:\/\//i.test(s))
  // A set-but-useless value is the dangerous case: someone believes they have
  // moved off the public endpoints when they have not. Say so.
  if (list.length === 0) {
    console.warn("[sui] SUI_RPC_URLS is set but contains no usable http(s) endpoints. Using the public ones.")
    return DEFAULT_ENDPOINTS
  }
  return list
}

type RpcOutcome = { ok: true; result: unknown } | { ok: false; reason: string }

/**
 * One call, across the endpoint list. A JSON-RPC `error` object is a node
 * DECLINING to answer, not an answer, so it does not stop the fallback.
 */
async function rpc(method: string, params: unknown[], timeoutMs = 12_000): Promise<RpcOutcome> {
  let lastReason = "no endpoint answered"
  for (const url of endpoints()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) { lastReason = `${new URL(url).host} returned ${res.status}`; continue }
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } }
      if (body.error) { lastReason = body.error.message ?? "the node declined the request"; continue }
      if (body.result === undefined) { lastReason = `${new URL(url).host} returned no result`; continue }
      return { ok: true, result: body.result }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "network error"
    }
  }
  return { ok: false, reason: lastReason }
}

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

interface RawEffects {
  status?: { status?: string; error?: string }
  gasUsed?: { computationCost?: string; storageCost?: string; storageRebate?: string }
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
  const r = out.result as { digest?: string; timestampMs?: string; checkpoint?: string; effects?: RawEffects; transaction?: { data?: { sender?: string } } } | null
  if (!r || typeof r !== "object") return { kind: "not_found" }

  const eff = r.effects ?? {}
  const failed = eff.status?.status === "failure"
  const error = failed ? (eff.status?.error ?? null) : null
  const g = eff.gasUsed
  let gasUsed: bigint | null = null
  if (g) {
    try {
      gasUsed = BigInt(g.computationCost ?? "0") + BigInt(g.storageCost ?? "0") - BigInt(g.storageRebate ?? "0")
    } catch { gasUsed = null }
  }

  const tx: SuiTransaction = {
    digest: r.digest ?? d,
    timestampMs: r.timestampMs ? Number(r.timestampMs) : null,
    checkpoint: r.checkpoint ?? null,
    sender: r.transaction?.data?.sender ?? null,
    status: failed ? "failed" : "success",
    gasUsed: gasUsed === null ? null : gasUsed.toString(),
    gasFormatted: gasUsed === null ? null : `${formatMist(gasUsed)} SUI`,
    error,
    ...(error ? { decodedAbort: decodeSuiAbort(error, errmap) } : {}),
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
  for (const raw of page.data) {
    const r = raw as { digest?: string; timestampMs?: string; checkpoint?: string; effects?: RawEffects; transaction?: { data?: { sender?: string } } }
    const eff = r.effects ?? {}
    const failed = eff.status?.status === "failure"
    const error = failed ? (eff.status?.error ?? null) : null
    const g = eff.gasUsed
    let gasUsed: bigint | null = null
    if (g) {
      try { gasUsed = BigInt(g.computationCost ?? "0") + BigInt(g.storageCost ?? "0") - BigInt(g.storageRebate ?? "0") } catch { gasUsed = null }
    }
    txs.push({
      digest: r.digest ?? "",
      timestampMs: r.timestampMs ? Number(r.timestampMs) : null,
      checkpoint: r.checkpoint ?? null,
      sender: r.transaction?.data?.sender ?? a,
      status: failed ? "failed" : "success",
      gasUsed: gasUsed === null ? null : gasUsed.toString(),
      gasFormatted: gasUsed === null ? null : `${formatMist(gasUsed)} SUI`,
      error,
      ...(error ? { decodedAbort: decodeSuiAbort(error, errmap) } : {}),
    })
  }
  return { kind: "ok", value: txs }
}
