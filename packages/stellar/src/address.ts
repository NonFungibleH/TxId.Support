/**
 * Stellar addresses are "strkeys": base32 with a version byte and a CRC16.
 *
 * The checksum is why this file validates rather than pattern-matches. A typo in
 * a 56-character address still looks like an address, and accepting one means
 * telling somebody their account does not exist when in fact we asked about an
 * account that was never theirs. Sixteen lines of CRC is a cheap way to say
 * "that is not a Stellar address" instead.
 */
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

/** Version bytes we accept, from Stellar's SEP-23 strkey spec. */
const VERSION = {
  ed25519PublicKey: 6 << 3,   // G
  contract: 2 << 3,           // C
  muxedAccount: 12 << 3,      // M
} as const

function base32Decode(s: string): Uint8Array | null {
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of s) {
    const i = B32.indexOf(ch)
    if (i === -1) return null
    value = (value << 5) | i
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

/** CRC16-XModem, which is what Stellar's strkey checksum is. */
function crc16(data: Uint8Array): number {
  let crc = 0x0000
  for (const byte of data) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc & 0xffff
}

export type StrkeyKind = "account" | "contract" | "muxed"

/** The kind of strkey this is, or null when it is not a valid one. */
export function strkeyKind(value: string): StrkeyKind | null {
  const s = value.trim().toUpperCase()
  if (!/^[A-Z2-7]{56}$/.test(s) && !/^[A-Z2-7]{69}$/.test(s)) return null
  const raw = base32Decode(s)
  if (!raw || raw.length < 3) return null

  const version = raw[0]!
  const payload = raw.subarray(0, raw.length - 2)
  const checksum = raw[raw.length - 2]! | (raw[raw.length - 1]! << 8)
  if (crc16(payload) !== checksum) return null

  if (version === VERSION.ed25519PublicKey) return "account"
  if (version === VERSION.contract) return "contract"
  if (version === VERSION.muxedAccount) return "muxed"
  return null
}

export const isStellarAccount = (v: string) => strkeyKind(v) === "account"
export const isStellarContract = (v: string) => strkeyKind(v) === "contract"
export const isStellarAddress = (v: string) => strkeyKind(v) !== null

/**
 * A Stellar transaction hash is 64 hex characters and carries NO prefix, which
 * makes it format-identical to an EVM hash without its `0x` and to an Aptos
 * hash. Routing therefore cannot be decided by the hash alone; the caller has
 * to know Stellar is in play. Same situation the Aptos arm already handles.
 */
export function normalizeStellarTxHash(hash: string): string | null {
  const h = hash.trim().toLowerCase().replace(/^0x/, "")
  return /^[0-9a-f]{64}$/.test(h) ? h : null
}
