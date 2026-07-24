export type { AptosBalance, AptosTransaction, DecodedAbort, AptosModuleFunction, AptosModuleAbi } from "./types"
export { decodeAbort } from "./abort"
export type { AbortErrmap } from "./abort"
export { isAptosAddress, normalizeAptosAddress } from "./address"

export function isAptosChain(chainId: string): boolean {
  return chainId === "aptos"
}
