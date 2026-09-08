import { relativeAge } from "@txid/shared"
import { normalizeStellarTxHash, strkeyKind } from "./address"
import { explain } from "./codes"
import { horizon } from "./rpc"
import type { StellarBalance, StellarBalanceLine, StellarLookup, StellarTransaction } from "./types"
import { decodeTransactionResult, type DecodedStellarResult } from "./xdr"

/** 1 XLM = 10,000,000 stroops. */
const STROOPS = 10_000_000n

function formatStroops(raw: bigint, dp = 7): string {
  const neg = raw < 0n
  const v = neg ? -raw : raw
  const whole = v / STROOPS
  const frac = (v % STROOPS).toString().padStart(7, "0").slice(0, dp).replace(/0+$/, "")
  return `${neg ? "-" : ""}${whole.toLocaleString("en-US")}${frac ? "." + frac : ""}`
}

/**
 * Turn a decoded result into the sentence a user gets.
 *
 * The shape of the honest floor matters here. Stellar defines 208 codes and we
 * hold English for the ones that occur; for the rest the answer is the
 * operation, the constant name and the number, with an explicit statement that
 * we have no description. Never a sentence inferred from the constant's words:
 * "LINE_FULL" and "LOW_RESERVE" are both guessable and both easy to guess wrong.
 */
export function describeFailure(d: DecodedStellarResult | null): string {
  if (!d) {
    return "The network reported this transaction as failed but did not give a result we could decode, so we cannot say why. Nothing it set out to do took effect."
  }

  const op = d.failing
  if (op) {
    const known = explain(op.name)
    const where = op.type ? `The ${op.type.toLowerCase().replace(/_/g, " ")} operation` : "One operation"
    const at = d.operationCount && d.operationCount > 1 ? ` (operation ${op.index + 1} of ${d.operationCount})` : ""
    if (known) return `${known}${at}`
    if (op.name) {
      return `${where}${at} failed with ${op.name}. Stellar defines that code but we hold no description for it, so what it means in this context is best confirmed with the protocol. Nothing the transaction set out to do took effect.`
    }
    return `${where}${at} failed with code ${op.code}, which is not a code Stellar's published definitions name. Nothing the transaction set out to do took effect.`
  }

  const top = explain(d.code)
  if (top && d.code !== "txFAILED") return top

  // txFAILED with no failing operation read: either the walk stopped at a
  // success payload, or the array was empty. Say which, rather than implying we
  // read the whole thing.
  if (d.incomplete) {
    const read = d.operations.length
    return `One of this transaction's ${d.operationCount ?? "several"} operations failed, but the failure is recorded after an operation that succeeded, and we can only read the result up to that point (${read} read). The transaction as a whole was rolled back, so nothing it set out to do took effect. The protocol can give the exact operation error.`
  }
  return top ?? `The transaction failed with ${d.code}. Nothing it set out to do took effect.`
}

interface RawHorizonTx {
  hash?: string
  ledger?: number
  created_at?: string
  source_account?: string
  successful?: boolean
  fee_charged?: string | number
  operation_count?: number
  result_xdr?: string
}

function toTransaction(r: RawHorizonTx, fallbackHash: string): StellarTransaction {
  const failed = r.successful === false
  const decoded = failed && r.result_xdr ? decodeTransactionResult(r.result_xdr) : null
  let feeStroops: bigint | null = null
  try {
    if (r.fee_charged !== undefined) feeStroops = BigInt(r.fee_charged)
  } catch {
    feeStroops = null
  }
  return {
    hash: r.hash ?? fallbackHash,
    ledger: typeof r.ledger === "number" ? r.ledger : null,
    createdAt: r.created_at ?? null,
    age: r.created_at ? relativeAge(r.created_at) : null,
    sourceAccount: r.source_account ?? null,
    status: failed ? "failed" : "success",
    feeChargedStroops: feeStroops === null ? null : feeStroops.toString(),
    feeXlm: feeStroops === null ? null : `${formatStroops(feeStroops)} XLM`,
    operationCount: typeof r.operation_count === "number" ? r.operation_count : null,
    ...(failed
      ? { decodedResult: decoded, reason: describeFailure(decoded), resultXdr: r.result_xdr ?? null }
      : {}),
  }
}

export async function getStellarTransaction(hash: string): Promise<StellarLookup<StellarTransaction>> {
  const h = normalizeStellarTxHash(hash)
  // Rejecting here keeps a typo from being reported as "the network could not
  // be reached". A Stellar hash is 64 hex with no prefix, the same shape as an
  // EVM hash without its 0x, so the CALLER has to know Stellar is in play.
  if (!h) return { kind: "unavailable", reason: "that is not a Stellar transaction hash" }

  const out = await horizon(`/transactions/${h}`)
  if (!out.ok) return out.kind === "not_found" ? { kind: "not_found" } : { kind: "unavailable", reason: out.reason }
  const r = out.result as RawHorizonTx | null
  if (!r || typeof r !== "object") return { kind: "unavailable", reason: "unexpected response shape" }
  return { kind: "ok", value: toTransaction(r, h) }
}

interface RawBalance {
  asset_type?: string
  asset_code?: string
  asset_issuer?: string
  balance?: string
  limit?: string
  is_authorized?: boolean
}

export async function getStellarBalance(account: string): Promise<StellarLookup<StellarBalance>> {
  const a = account.trim().toUpperCase()
  if (strkeyKind(a) !== "account") return { kind: "unavailable", reason: "that is not a Stellar account address" }

  const out = await horizon(`/accounts/${a}`)
  if (!out.ok) return out.kind === "not_found" ? { kind: "not_found" } : { kind: "unavailable", reason: out.reason }
  const r = out.result as { balances?: RawBalance[]; subentry_count?: number } | null
  if (!r || !Array.isArray(r.balances)) return { kind: "unavailable", reason: "unexpected response shape" }

  let xlm = "0"
  const balances: StellarBalanceLine[] = []
  for (const b of r.balances) {
    const native = b.asset_type === "native"
    if (native) xlm = b.balance ?? "0"
    balances.push({
      asset: native ? "native" : `${b.asset_code ?? "?"}:${b.asset_issuer ?? "?"}`,
      code: native ? "XLM" : (b.asset_code ?? "?"),
      issuer: native ? null : (b.asset_issuer ?? null),
      balance: b.balance ?? "0",
      limit: b.limit ?? null,
      authorized: typeof b.is_authorized === "boolean" ? b.is_authorized : null,
    })
  }

  // The reserve is base (1 XLM) plus 0.5 XLM per subentry, and it is the reason
  // a Stellar user can see a balance and be unable to spend it. Null when the
  // subentry count was not returned, never a guessed number.
  const sub = typeof r.subentry_count === "number" ? r.subentry_count : null
  const reserve = sub === null ? null : (1 + 0.5 * sub).toFixed(1)

  return { kind: "ok", value: { account: a, xlm, balances, reserveXlm: reserve, subentryCount: sub } }
}

export async function getStellarRecentTransactions(
  account: string,
  limit = 10,
): Promise<StellarLookup<StellarTransaction[]>> {
  const a = account.trim().toUpperCase()
  if (strkeyKind(a) !== "account") return { kind: "unavailable", reason: "that is not a Stellar account address" }
  const n = Math.min(Math.max(limit, 1), 50)

  // include_failed IS THE POINT. Horizon omits failed transactions by default,
  // so without it a user's failures are invisible to the one product built to
  // explain them, and their history would read as if nothing ever went wrong.
  const out = await horizon(`/accounts/${a}/transactions?order=desc&limit=${n}&include_failed=true`)
  if (!out.ok) return out.kind === "not_found" ? { kind: "not_found" } : { kind: "unavailable", reason: out.reason }
  const page = out.result as { _embedded?: { records?: RawHorizonTx[] } } | null
  const records = page?._embedded?.records
  // An empty list is a REAL answer: this account has no transactions. It is not
  // the same as a failed read, and only the tri-state can tell them apart.
  if (!Array.isArray(records)) return { kind: "unavailable", reason: "unexpected response shape" }
  return { kind: "ok", value: records.map(r => toTransaction(r, r.hash ?? "")) }
}
