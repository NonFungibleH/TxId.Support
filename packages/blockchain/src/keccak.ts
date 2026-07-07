// Keccak-256 (Ethereum variant), pure TypeScript with BigInt lanes — no
// dependency. Validated against known vectors (empty string, "abc", and the
// ERC-20 Transfer event topic). Used to derive an event's topic0 from its ABI
// signature so we can query contract logs by event. Array reads use non-null
// assertions because every index is provably in-bounds (fixed 25-lane state).

const MASK = (1n << 64n) - 1n

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
]
const ROTC = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44]
const PILN = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1]

const rotl = (x: bigint, n: number): bigint => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK

function keccakf(st: bigint[]): void {
  const bc = new Array<bigint>(5).fill(0n)
  for (let r = 0; r < 24; r++) {
    for (let i = 0; i < 5; i++) bc[i] = st[i]! ^ st[i + 5]! ^ st[i + 10]! ^ st[i + 15]! ^ st[i + 20]!
    for (let i = 0; i < 5; i++) {
      const t = bc[(i + 4) % 5]! ^ rotl(bc[(i + 1) % 5]!, 1)
      for (let j = 0; j < 25; j += 5) st[j + i] = st[j + i]! ^ t
    }
    let t = st[1]!
    for (let i = 0; i < 24; i++) {
      const j = PILN[i]!
      const tmp = st[j]!
      st[j] = rotl(t, ROTC[i]!)
      t = tmp
    }
    for (let j = 0; j < 25; j += 5) {
      for (let i = 0; i < 5; i++) bc[i] = st[j + i]!
      for (let i = 0; i < 5; i++) st[j + i] = st[j + i]! ^ ((~bc[(i + 1) % 5]! & MASK) & bc[(i + 2) % 5]!)
    }
    st[0] = st[0]! ^ RC[r]!
  }
}

/** Keccak-256 of the input bytes, returned as a lowercase hex string (no 0x). */
export function keccak256(input: Uint8Array): string {
  const rate = 136
  const st = new Array<bigint>(25).fill(0n)
  const len = input.length
  const q = rate - (len % rate)
  const padded = new Uint8Array(len + q)
  padded.set(input)
  padded[len] = 0x01
  padded[padded.length - 1] = padded[padded.length - 1]! | 0x80
  for (let b = 0; b < padded.length; b += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n
      for (let k = 0; k < 8; k++) lane |= BigInt(padded[b + i * 8 + k]!) << BigInt(8 * k)
      st[i] = st[i]! ^ lane
    }
    keccakf(st)
  }
  let out = ""
  for (let i = 0; i < 4; i++)
    for (let k = 0; k < 8; k++)
      out += Number((st[i]! >> BigInt(8 * k)) & 0xffn).toString(16).padStart(2, "0")
  return out
}

/** topic0 (0x-prefixed) for an event signature like "FeesChanged(uint256,uint256)". */
export function eventTopic0(signature: string): string {
  return "0x" + keccak256(new TextEncoder().encode(signature))
}
