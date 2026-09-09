// Dispatch, not Helius directly: with no HELIUS_API_KEY these fall back to the
// keyless JSON-RPC path in rpc.ts rather than throwing and pausing the chain.
export { getSolanaWalletBalance, getSolanaRecentTransactions, getSolanaTransactionBySignature, heliusConfigured } from "./dispatch"
export { getSolanaWalletBalanceRpc, getSolanaRecentTransactionsRpc, getSolanaTransactionBySignatureRpc, solanaSignatureAbsent, usingKeylessSolana } from "./rpc"
export { solanaRetention } from "./rpc"
export type { SolanaRetention } from "./rpc"
export { fetchIdl, fetchIdlFromRegistry } from "./idl"
export type { IdlLookup } from "./idl"
export { decodeSolanaError } from "./errors"
export { SolanaLookupUnavailableError } from "./lookup"
export type { DecodedSolanaError, SolanaErrorCause, SolanaErrorContext } from "./errors"
export type { SolanaBalance, SolanaTokenBalance, SolanaTransaction, SolanaTokenTransfer, SolanaNativeTransfer } from "./types"

export function isSolanaChain(chainId: string): boolean {
  return chainId === "solana"
}
