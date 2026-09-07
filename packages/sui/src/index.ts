export { decodeSuiAbort, normalizeSuiAddress } from "./abort"
export type { DecodedSuiAbort, SuiErrmap } from "./abort"
export { getSuiTransaction, getSuiBalance, getSuiRecentTransactions } from "./client"
export type { SuiTransaction, SuiBalance, SuiCoinBalance, SuiLookup } from "./types"

/** Chain id string, like "aptos" and "solana". Not a hex chain id: Sui is not EVM. */
export function isSuiChain(chainId: string): boolean {
  return chainId === "sui"
}
