import type { DecodedStellarResult } from "./xdr"

export interface StellarBalanceLine {
  /** "native" for XLM, else "CODE:ISSUER" as Horizon reports the pair. */
  asset: string
  code: string
  issuer: string | null
  balance: string
  /**
   * The trustline's ceiling. Stellar-specific and load-bearing: a payment can
   * fail because the RECIPIENT's limit would be exceeded, which has nothing to
   * do with either party's balance.
   */
  limit: string | null
  /** False when the issuer has not authorised this account to hold the asset. */
  authorized: boolean | null
}

export interface StellarBalance {
  account: string
  /** Formatted XLM. */
  xlm: string
  balances: StellarBalanceLine[]
  /**
   * How much XLM this account must keep. Base reserve plus one per subentry, so
   * spendable XLM is `xlm - reserveXlm`. Null means NOT COMPUTED, never zero.
   */
  reserveXlm: string | null
  subentryCount: number | null
}

export interface StellarTransaction {
  hash: string
  ledger: number | null
  createdAt: string | null
  age: string | null
  sourceAccount: string | null
  status: "success" | "failed"
  /** Fee actually charged, in stroops (1 XLM = 10,000,000 stroops). */
  feeChargedStroops: string | null
  feeXlm: string | null
  operationCount: number | null
  /** Present on failures. Null when the result could not be decoded at all. */
  decodedResult?: DecodedStellarResult | null
  /** Plain English for the failure, always set when the transaction failed. */
  reason?: string
  /** Base64 result XDR exactly as the network gave it, so a reviewer can re-decode. */
  resultXdr?: string | null
}

/**
 * Three outcomes, never two. `not_found` is a FINDING (Horizon looked and has no
 * such record); `unavailable` is not. Collapsing them is how an outage reaches a
 * user as "your transaction does not exist".
 */
export type StellarLookup<T> =
  | { kind: "ok"; value: T }
  | { kind: "not_found" }
  | { kind: "unavailable"; reason: string }
