import type { DecodedSuiAbort } from "./abort"

export interface SuiBalance {
  /** Formatted SUI, e.g. "12.3456". */
  sui: string
  /** Raw MIST (1 SUI = 1e9 MIST). */
  suiRaw: string
  coins: SuiCoinBalance[]
}

export interface SuiCoinBalance {
  coinType: string
  /** Last path segment of the type, e.g. "USDC". Not a verified symbol. */
  symbol: string
  amount: string
  amountRaw: string
  decimals: number | null
}

export interface SuiTransaction {
  digest: string
  timestampMs: number | null
  checkpoint: string | null
  sender: string | null
  status: "success" | "failed"
  /** Total gas in MIST: computation + storage, less the storage rebate. */
  gasUsed: string | null
  gasFormatted: string | null
  /** The raw status string, exactly as the node gave it. */
  error: string | null
  decodedAbort?: DecodedSuiAbort
}

/**
 * Three outcomes, never two. `not_found` is a FINDING (the node looked and has
 * no such digest); `unavailable` is not. Collapsing them is how an outage
 * reaches a user as "your transaction does not exist".
 */
export type SuiLookup<T> =
  | { kind: "ok"; value: T }
  | { kind: "not_found" }
  | { kind: "unavailable"; reason: string }
