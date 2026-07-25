export type { AptosBalance, AptosTransaction, DecodedAbort, AptosModuleFunction, AptosModuleAbi, AptosWalletDiagnosis } from "./types"
export { decodeAbort } from "./abort"
export type { AbortErrmap } from "./abort"
export { isAptosAddress, normalizeAptosAddress } from "./address"
export { PROTOCOL_ERRMAPS, errmapFor } from "./errmap"
export {
  getLedgerInfo,
  getAccount,
  getAptosModuleAbi,
  getAptosTransactionByHash,
  viewFunction,
  getAptosNetworkStatus,
  formatUnits,
} from "./fullnode"
export type { AptosLedgerInfo, AptosNetworkStatus } from "./fullnode"
export {
  aptosGraphql,
  getAptosWalletBalance,
  getAptosRecentTransactions,
  getAptosAssetMetadata,
  diagnoseAptosWallet,
} from "./indexer"
export type { AptosAssetMetadata } from "./indexer"
export { resolveAptosName, reverseAptosName } from "./names"

export function isAptosChain(chainId: string): boolean {
  return chainId === "aptos"
}
