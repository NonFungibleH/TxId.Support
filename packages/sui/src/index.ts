export { decodeSuiAbort, normalizeSuiAddress } from "./abort"
export type { DecodedSuiAbort, SuiAbortContext, SuiErrmap } from "./abort"
export { getSuiTransaction, getSuiBalance, getSuiRecentTransactions } from "./client"
export { DEEPBOOK_PACKAGE, MAPPED_SUI_PACKAGES, SUI_ERRMAPS } from "./errmap"
export { resolveOriginalPackage } from "./package"
export type { PackageOrigin } from "./package"
export type { SuiTransaction, SuiBalance, SuiCoinBalance, SuiLookup } from "./types"

/** Chain id string, like "aptos" and "solana". Not a hex chain id: Sui is not EVM. */
export function isSuiChain(chainId: string): boolean {
  return chainId === "sui"
}
