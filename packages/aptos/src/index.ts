export type { AptosBalance, AptosTransaction, DecodedAbort, AptosModuleFunction, AptosModuleAbi, AptosWalletDiagnosis } from "./types"
export { decodeAbort } from "./abort"
export type { AbortErrmap } from "./abort"
export { isAptosAddress, normalizeAptosAddress } from "./address"
export { PROTOCOL_ERRMAPS, errmapFor } from "./errmap"
export { PROTOCOL_ADAPTERS, adapterFor, getProtocolAccount, getProtocolMarkets, marketsInArguments, resolveProtocolAccountAddress } from "./protocols"
export type { ProtocolAdapter, ProtocolAccount } from "./protocols"
export {
  getLedgerInfo,
  getAccount,
  getAptosModuleAbi,
  getAptosTransactionByHash,
  getAptosPackages,
  viewFunction,
  viewFunctionResult,
  simulateAptosEntryFunction,
  getAptosNetworkStatus,
  formatUnits,
  microsToIso,
} from "./fullnode"
export type { AptosLedgerInfo, AptosNetworkStatus, AptosPackage, AptosSimulation, ViewResult } from "./fullnode"
export {
  aptosGraphql,
  getAptosWalletBalance,
  getAptosRecentTransactions,
  getAptosRecentTransactionsMerged,
  getAptosModuleEvents,
  getAptosAssetMetadata,
  getAptosAssetActivities,
  getAptosTokenSafety,
  getAptosDeployment,
  getAptosAccountsForAuthKey,
  getAptosAuthKeyStatus,
  diagnoseAptosWallet,
} from "./indexer"
export type {
  AptosHistoryAccount,
  AptosAssetMetadata,
  AptosAssetActivity,
  AptosModuleEvent,
  AptosModuleEventScan,
  AptosTokenSafety,
  AptosDeployment,
  AptosAccountsForAuthKey,
  AptosAuthKeyStatus,
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
export { getAptosObject, getAptosObjectsOwnedBy } from "./objects"
export type { AptosObject, AptosObjectLookup, AptosOwnedObject } from "./objects"
export { getAptosNfts, getAptosPendingNftClaims, getAptosNftActivity } from "./digital-assets"
export type { AptosNftHolding, AptosPendingNftClaim, AptosNftActivityEntry } from "./digital-assets"
export { resolveAptosName, reverseAptosName } from "./names"
export { getConfidentialState, confidentialNote, APT_FA_METADATA } from "./confidential"
export type { ConfidentialState } from "./confidential"

export function isAptosChain(chainId: string): boolean {
  return chainId === "aptos"
}
