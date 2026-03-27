import { CHAIN_CONFIGS } from "./types"

export function getExplorerUrl(chainId: string): string | null {
  return CHAIN_CONFIGS[chainId]?.explorer ?? null
}

export function getTxUrl(chainId: string, txHash: string): string | null {
  const base = getExplorerUrl(chainId)
  return base ? `${base}/tx/${txHash}` : null
}

export function getAddressUrl(chainId: string, address: string): string | null {
  const base = getExplorerUrl(chainId)
  return base ? `${base}/address/${address}` : null
}

export function getTokenUrl(chainId: string, tokenAddress: string): string | null {
  const base = getExplorerUrl(chainId)
  return base ? `${base}/token/${tokenAddress}` : null
}

/** Shorten an address for display: 0x1234…abcd */
export function shortenAddress(address: string, chars = 4): string {
  if (address.length < chars * 2 + 2) return address
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`
}

/** Shorten a tx hash for display */
export function shortenHash(hash: string, chars = 6): string {
  if (hash.length < chars * 2 + 2) return hash
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`
}
