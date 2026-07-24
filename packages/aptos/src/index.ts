export type { AptosBalance, AptosTransaction, DecodedAbort, AptosModuleFunction, AptosModuleAbi } from "./types"
export { decodeAbort } from "./abort"
export type { AbortErrmap } from "./abort"
export { isAptosAddress, normalizeAptosAddress } from "./address"
export {
  getLedgerInfo,
  getAccount,
  getAptosModuleAbi,
  getAptosTransactionByHash,
  viewFunction,
  getAptosNetworkStatus,
  diagnoseAptosWallet,
  formatUnits,
} from "./fullnode"
export type { AptosLedgerInfo, AptosNetworkStatus, AptosWalletDiagnosis } from "./fullnode"

export function isAptosChain(chainId: string): boolean {
  return chainId === "aptos"
}
