import type { DecodedSolanaError } from "./errors"

export interface SolanaBalance {
  sol: string           // formatted, e.g. "1.234"
  solRaw: number        // lamports
  tokens: SolanaTokenBalance[]
}

export interface SolanaTokenBalance {
  mint: string
  amount: string        // formatted with decimals
  amountRaw: string     // raw integer string
  decimals: number
}

export interface SolanaTransaction {
  signature: string
  blockTime: number | null   // unix timestamp, SECONDS
  /**
   * How long ago, computed here so the model never subtracts two clocks. Null
   * means blockTime was absent or unusable, never "just now".
   */
  age: string | null
  slot: number
  status: "success" | "failed"
  fee: number                // lamports
  description: string | null // Helius human-readable description
  type: string | null        // e.g. "SWAP", "TRANSFER"
  tokenTransfers: SolanaTokenTransfer[]
  nativeTransfers: SolanaNativeTransfer[]
  error: string | null       // raw error, as the chain reported it
  decodedError?: DecodedSolanaError  // what it MEANS, when the transaction failed
  programIds: string[]       // programs involved in the tx
}

export interface SolanaTokenTransfer {
  mint: string
  fromTokenAccount: string
  toTokenAccount: string
  fromUserAccount: string | null
  toUserAccount: string | null
  tokenAmount: number
}

export interface SolanaNativeTransfer {
  fromUserAccount: string
  toUserAccount: string
  amount: number   // lamports
}
