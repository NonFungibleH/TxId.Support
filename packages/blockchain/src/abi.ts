// Minimal ABI value decoder — no dependency. Covers the parameter types that
// appear in the overwhelming majority of real events and calls: address,
// uintN / intN, bool, bytesN, string, bytes. Complex types (arrays, tuples)
// decode to a placeholder rather than throwing. Used to decode a transaction's
// call arguments and its emitted event logs against an uploaded ABI.

export type AbiParam = { name?: string; type: string; indexed?: boolean }

function toWords(hex: string): string[] {
  const clean = hex.replace(/^0x/, "")
  const out: string[] = []
  for (let i = 0; i + 64 <= clean.length; i += 64) out.push(clean.slice(i, i + 64))
  return out
}

function decodeStatic(type: string, word: string): string {
  if (type === "address") return "0x" + word.slice(24)
  if (type === "bool") return BigInt("0x" + word) !== 0n ? "true" : "false"
  if (type.startsWith("uint")) return BigInt("0x" + word).toString()
  if (type.startsWith("int")) {
    let v = BigInt("0x" + word)
    if (v >= 1n << 255n) v -= 1n << 256n // two's complement
    return v.toString()
  }
  if (type.startsWith("bytes")) return "0x" + word // bytesN (fixed)
  return "0x" + word
}

function isDynamic(type: string): boolean {
  return type === "string" || type === "bytes" || type.endsWith("[]") || type.startsWith("tuple")
}

/** True if a type can be encoded/decoded inline (32 bytes). */
export function isStaticType(type: string): boolean {
  return !isDynamic(type)
}

/** ABI-encode a single static argument to a 32-byte hex word (no 0x). */
export function encodeStaticArg(type: string, value: string): string {
  if (type === "address") return value.replace(/^0x/, "").toLowerCase().padStart(64, "0")
  if (type === "bool") return (value === "true" || value === "1" ? "1" : "0").padStart(64, "0")
  if (type.startsWith("uint") || type.startsWith("int")) {
    let v = BigInt(value)
    if (v < 0n) v += 1n << 256n // two's complement
    return v.toString(16).padStart(64, "0")
  }
  if (type.startsWith("bytes")) return value.replace(/^0x/, "").padEnd(64, "0")
  return "0".repeat(64)
}

/** Flatten function outputs, expanding a single struct (tuple) into its fields. */
export function flattenOutputs(
  outputs: Array<{ type: string; name?: string; components?: Array<{ type: string; name?: string }> }>,
): AbiParam[] {
  const flat: AbiParam[] = []
  outputs.forEach((o, i) => {
    if (o.type === "tuple" && o.components) {
      o.components.forEach((c, j) => flat.push({ type: c.type, name: c.name || `field${j}` }))
    } else {
      flat.push({ type: o.type, name: o.name || `out${i}` })
    }
  })
  return flat
}

/** Decode a tightly-packed ABI parameter block (function args or event data). */
export function decodeParams(params: AbiParam[], dataHex: string): Record<string, string> {
  const result: Record<string, string> = {}
  const clean = dataHex.replace(/^0x/, "")
  const w = toWords(clean)
  params.forEach((p, i) => {
    const name = p.name && p.name.length > 0 ? p.name : `arg${i}`
    try {
      if (isDynamic(p.type)) {
        if (p.type === "string" || p.type === "bytes") {
          const offsetWord = Number(BigInt("0x" + (w[i] ?? "0"))) / 32
          const len = Number(BigInt("0x" + (w[offsetWord] ?? "0")))
          const start = (offsetWord + 1) * 64
          const hexData = clean.slice(start, start + len * 2)
          result[name] = p.type === "string"
            ? Buffer.from(hexData, "hex").toString("utf-8")
            : "0x" + hexData
        } else {
          result[name] = "[array]"
        }
      } else {
        result[name] = decodeStatic(p.type, w[i] ?? "0".repeat(64))
      }
    } catch {
      result[name] = "[unreadable]"
    }
  })
  return result
}

/**
 * Decode a single event log against its ABI entry. Indexed params come from
 * topics[1..], non-indexed from data. Indexed dynamic values are hashed on-chain
 * and cannot be recovered — marked "[hashed]".
 */
export function decodeEventLog(
  eventAbi: { name?: string; inputs?: AbiParam[] },
  topics: string[],
  dataHex: string,
): { name: string; params: Record<string, string> } | null {
  if (!eventAbi.name) return null
  const inputs = eventAbi.inputs ?? []
  const params: Record<string, string> = {}
  const nonIndexed: AbiParam[] = []
  let topicIdx = 1
  inputs.forEach((inp, i) => {
    const name = inp.name && inp.name.length > 0 ? inp.name : `arg${i}`
    if (inp.indexed) {
      const topic = topics[topicIdx++]
      if (topic) {
        params[name] = isDynamic(inp.type)
          ? "[hashed]"
          : decodeStatic(inp.type, topic.replace(/^0x/, ""))
      }
    } else {
      nonIndexed.push({ ...inp, name })
    }
  })
  Object.assign(params, decodeParams(nonIndexed, dataHex))
  return { name: eventAbi.name, params }
}
