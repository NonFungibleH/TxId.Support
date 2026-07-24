export type { AptosBalance, AptosTransaction, DecodedAbort, AptosModuleFunction, AptosModuleAbi } from "./types"

export function isAptosChain(chainId: string): boolean {
  return chainId === "aptos"
}

export function isAptosAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(addr)
}

export function normalizeAptosAddress(addr: string): string {
  return "0x" + addr.slice(2).toLowerCase().padStart(64, "0")
}
