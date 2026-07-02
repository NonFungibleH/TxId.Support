export { getSolanaWalletBalance, getSolanaRecentTransactions, getSolanaTransactionBySignature } from "./helius"
export { fetchIdlFromRegistry } from "./idl"
export type { SolanaBalance, SolanaTokenBalance, SolanaTransaction, SolanaTokenTransfer, SolanaNativeTransfer } from "./types"

export function isSolanaChain(chainId: string): boolean {
  return chainId === "solana"
}
