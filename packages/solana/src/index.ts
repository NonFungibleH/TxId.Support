export { getSolanaWalletBalance, getSolanaRecentTransactions, getSolanaTransactionBySignature } from "./helius"
export { fetchIdl, fetchIdlFromRegistry } from "./idl"
export type { IdlLookup } from "./idl"
export { decodeSolanaError } from "./errors"
export { SolanaLookupUnavailableError } from "./lookup"
export type { DecodedSolanaError, SolanaErrorCause, SolanaErrorContext } from "./errors"
export type { SolanaBalance, SolanaTokenBalance, SolanaTransaction, SolanaTokenTransfer, SolanaNativeTransfer } from "./types"

export function isSolanaChain(chainId: string): boolean {
  return chainId === "solana"
}
