export function isAptosAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{1,64}$/.test(addr)
}

export function normalizeAptosAddress(addr: string): string {
  const hex = addr.startsWith("0x") ? addr.slice(2) : addr
  return "0x" + hex.toLowerCase().padStart(64, "0")
}
