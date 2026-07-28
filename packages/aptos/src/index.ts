export type { AptosBalance, AptosTransaction, DecodedAbort, AptosModuleFunction, AptosModuleAbi, AptosWalletDiagnosis } from "./types"
export { decodeAbort } from "./abort"
export type { AbortErrmap } from "./abort"
export { isAptosAddress, normalizeAptosAddress } from "./address"
export { PROTOCOL_ERRMAPS, errmapFor } from "./errmap"
export { PROTOCOL_ADAPTERS, adapterFor, getProtocolAccount, getProtocolMarkets } from "./protocols"
export type { ProtocolAdapter, ProtocolAccount } from "./protocols"
export {
  getLedgerInfo,
  getAccount,
  getAptosModuleAbi,
  getAptosTransactionByHash,
  getAptosPackages,
  viewFunction,
  viewFunctionResult,
  getAptosNetworkStatus,
  formatUnits,
  microsToIso,
} from "./fullnode"
export type { AptosLedgerInfo, AptosNetworkStatus, AptosPackage } from "./fullnode"
export {
  aptosGraphql,
  getAptosWalletBalance,
  getAptosRecentTransactions,
  getAptosAssetMetadata,
  getAptosAssetActivities,
  getAptosTokenSafety,
  getAptosDeployment,
  diagnoseAptosWallet,
} from "./indexer"
export type {
  AptosAssetMetadata,
  AptosAssetActivity,
  AptosTokenSafety,
  AptosDeployment,
} from "./indexer"
export {
  getAptosDelegations,
  getAptosStakingActivity,
  getAptosPoolLockup,
  getAptosStakeFromChain,
} from "./staking"
export type {
  AptosDelegationPosition,
  AptosStakingActivity,
  AptosPoolLockup,
  AptosDelegatorStake,
} from "./staking"
export { resolveAptosName, reverseAptosName } from "./names"

export function isAptosChain(chainId: string): boolean {
  return chainId === "aptos"
}
