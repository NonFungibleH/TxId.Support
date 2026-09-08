export { isStellarAccount, isStellarAddress, isStellarContract, normalizeStellarTxHash, strkeyKind } from "./address"
export type { StrkeyKind } from "./address"
export { CODE_NAMES, EXPLAINED_CONSTANTS, OPERATION_TYPES, RESULT_CODE_ENUM_FOR_OP, codeName, explain } from "./codes"
export { describeFailure, getStellarBalance, getStellarRecentTransactions, getStellarTransaction } from "./client"
export { horizonEndpoints, soroban, sorobanEndpoints } from "./rpc"
export { decodeTransactionResult } from "./xdr"
export type { DecodedStellarResult, StellarOperationResult } from "./xdr"
export type { StellarBalance, StellarBalanceLine, StellarLookup, StellarTransaction } from "./types"

/** Chain id string, like "aptos" and "sui". Not a hex chain id: Stellar is not EVM. */
export function isStellarChain(chainId: string): boolean {
  return chainId === "stellar"
}
