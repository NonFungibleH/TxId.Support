/**
 * The address maths needed to find a program's on-chain IDL, with no
 * dependencies.
 *
 * WHY BY HAND. Reaching the IDL needs base58, sha256 and one ed25519 curve
 * check, and pulling @solana/web3.js in for that would add a large runtime
 * dependency to a package that otherwise only makes HTTP calls. The maths is
 * small, fixed, and specified; the library is not.
 */
import { createHash } from "node:crypto"

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
const MAP = new Map([...ALPHABET].map((c, i) => [c, i]))

export function base58Decode(s: string): Uint8Array | null {
  if (!s || /[0OIl]/.test(s)) return null
  let n = 0n
  for (const c of s) {
    const v = MAP.get(c)
    if (v === undefined) return null
    n = n * 58n + BigInt(v)
  }
  const bytes: number[] = []
  while (n > 0n) { bytes.unshift(Number(n & 0xffn)); n >>= 8n }
  // Every leading '1' is a leading zero byte, which the integer form loses.
  for (const c of s) { if (c !== "1") break; bytes.unshift(0) }
  return Uint8Array.from(bytes)
}

export function base58Encode(bytes: Uint8Array): string {
  let n = 0n
  for (const b of bytes) n = (n << 8n) | BigInt(b)
  let out = ""
  while (n > 0n) { out = ALPHABET[Number(n % 58n)] + out; n /= 58n }
  for (const b of bytes) { if (b !== 0) break; out = "1" + out }
  return out
}

// ── ed25519, only enough of it to answer "is this point on the curve?" ──────
const P = (1n << 255n) - 19n
/** -121665/121666 mod p, the curve's d parameter. */
const D = 37095705934669439343138083508754565189542113879843219016388785533085940283555n

function powMod(base: bigint, exp: bigint, mod: bigint): bigint {
  let r = 1n, b = base % mod, e = exp
  while (e > 0n) {
    if (e & 1n) r = (r * b) % mod
    b = (b * b) % mod
    e >>= 1n
  }
  return r
}

/**
 * A program-derived address is DEFINED as one that is NOT a valid ed25519
 * point, which is what makes it unsignable. Deriving one therefore means
 * hashing with successive bump seeds until the result falls off the curve.
 */
export function isOnCurve(bytes: Uint8Array): boolean {
  if (bytes.length !== 32) return false
  let y = 0n
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(bytes[i]!)
  y &= (1n << 255n) - 1n           // the top bit is x's sign, not part of y
  if (y >= P) return false
  const y2 = (y * y) % P
  const u = (y2 - 1n + P) % P
  const v = (D * y2 + 1n) % P
  // x² = u/v, and a solution exists only if u/v is a quadratic residue.
  const x2 = (u * powMod(v, P - 2n, P)) % P
  if (x2 === 0n) return true
  return powMod(x2, (P - 1n) / 2n, P) === 1n
}

const sha256 = (parts: Uint8Array[]): Uint8Array => {
  const h = createHash("sha256")
  for (const p of parts) h.update(p)
  return new Uint8Array(h.digest())
}

const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress")

/** The first bump seed whose hash is off the curve, as Solana defines it. */
export function findProgramAddress(seeds: Uint8Array[], programId: Uint8Array): { address: Uint8Array; bump: number } | null {
  for (let bump = 255; bump >= 0; bump--) {
    const candidate = sha256([...seeds, Uint8Array.of(bump), programId, PDA_MARKER])
    if (!isOnCurve(candidate)) return { address: candidate, bump }
  }
  return null
}

/** Solana's createWithSeed: a plain hash, no curve condition. */
export function createWithSeed(base: Uint8Array, seed: string, owner: Uint8Array): Uint8Array {
  return sha256([base, new TextEncoder().encode(seed), owner])
}

/**
 * Where Anchor writes a program's IDL: createWithSeed(pda([], program),
 * "anchor:idl", program). Returns null only if the program id is not a valid
 * address.
 */
export function anchorIdlAddress(programId: string): string | null {
  const pid = base58Decode(programId)
  if (!pid || pid.length !== 32) return null
  const base = findProgramAddress([], pid)
  if (!base) return null
  return base58Encode(createWithSeed(base.address, "anchor:idl", pid))
}
