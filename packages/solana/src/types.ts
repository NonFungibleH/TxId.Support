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
  blockTime: number | null   // unix timestamp
  slot: number
  status: "success" | "failed"
  fee: number                // lamports
  description: string | null // Helius human-readable description
  type: string | null        // e.g. "SWAP", "TRANSFER"
  tokenTransfers: SolanaTokenTransfer[]
  nativeTransfers: SolanaNativeTransfer[]
  error: string | null       // error message if failed
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
