import { CHAIN_CONFIGS } from "./types"
import { functionSelector } from "./keccak"

/**
 * What is different about Arc, Circle's L1 (chain 5042), in one place.
 *
 * Every rule here was checked against Arc itself on 2026-11-25, not read off a
 * docs page and trusted: the revert strings below are what mainnet and testnet
 * actually return, and `isBlacklisted` was called on the live USDC contract.
 * See docs.arc.io/arc/references/evm-differences for the full list.
 */
export const ARC = {
  CHAIN_ID: "0x13b2",
  /** The USDC ERC-20 interface. The SAME balance as native, at 6 decimals. */
  USDC: "0x3600000000000000000000000000000000000000",
  EURC: "0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1",
  /** Wraps a call and keeps the user's wallet as msg.sender for the target. */
  MEMO: "0x5294E9927c3306DcBaDb03fe70b92e01cCede505",
  /** Batches calls and keeps the user's wallet as msg.sender for each one. */
  MULTICALL3_FROM: "0x522fAf9A91c41c443c66765030741e4AaCe147D0",
  /** Emits the EIP-7708 Transfer log for every native USDC movement. */
  SYSTEM_EMITTER: "0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE",
  /** The mempool silently discards anything with maxFeePerGas below this. */
  FEE_FLOOR_GWEI: 20,
} as const

export function isArc(chainId: string): boolean {
  return CHAIN_CONFIGS[chainId]?.id === ARC.CHAIN_ID
}

const MEMO_SELECTOR = functionSelector("memo(address,bytes,bytes32,bytes)")
const AGGREGATE3_SELECTOR = functionSelector("aggregate3((address,bool,bytes)[])")

function word(hex: string, i: number): string | null {
  const w = hex.slice(i * 64, i * 64 + 64)
  return w.length === 64 ? w : null
}

function asAddress(w: string | null): string | null {
  if (!w || !/^0{24}[0-9a-f]{40}$/i.test(w)) return null
  return "0x" + w.slice(24).toLowerCase()
}

function asIndex(w: string | null, max: number): number | null {
  if (!w) return null
  try {
    const n = BigInt("0x" + w)
    return n <= BigInt(max) ? Number(n) : null
  } catch { return null }
}

/**
 * The contract(s) a transaction actually acted on.
 *
 * On Arc, `tx.to` can be Memo or Multicall3From, which forward the call while
 * keeping the user's wallet as the sender. Matching on `tx.to` alone would say
 * a user never touched a protocol they used through either one. Anything that
 * cannot be decoded falls back to `tx.to` itself rather than a guess.
 */
export function routedTargets(to: string | null | undefined, input: string | null | undefined): string[] {
  if (!to) return []
  const router = to.toLowerCase()
  const data = (input ?? "").toLowerCase()
  const body = data.slice(10)

  if (router === ARC.MEMO.toLowerCase() && data.startsWith(MEMO_SELECTOR.toLowerCase())) {
    const target = asAddress(word(body, 0))
    return target ? [target] : [to]
  }

  if (router === ARC.MULTICALL3_FROM.toLowerCase() && data.startsWith(AGGREGATE3_SELECTOR.toLowerCase())) {
    const words = body.length / 64
    const arrayAt = asIndex(word(body, 0), words * 32)
    if (arrayAt === null || arrayAt % 32 !== 0) return [to]
    const head = arrayAt / 32
    const count = asIndex(word(body, head), 256)
    if (count === null || count === 0) return [to]
    const targets: string[] = []
    for (let i = 0; i < count; i++) {
      const rel = asIndex(word(body, head + 1 + i), words * 32)
      if (rel === null || rel % 32 !== 0) return [to]
      const target = asAddress(word(body, head + 1 + rel / 32))
      if (!target) return [to]
      targets.push(target)
    }
    return targets
  }

  return [to]
}

/** Tri-state, like every read whose answer reaches a user. */
export type BlocklistRead = { kind: "ok"; blocklisted: boolean } | { kind: "unavailable" }

/**
 * Whether the USDC contract reports this address as blocklisted. On Arc that
 * matters more than anywhere: USDC is the gas token, so a blocklisted sender
 * cannot transact at all, and is refused before the transaction runs.
 */
export async function readUsdcBlocklisted(address: string, chainId: string): Promise<BlocklistRead> {
  const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
  if (!rpcUrl || !/^0x[0-9a-fA-F]{40}$/.test(address)) return { kind: "unavailable" }
  try {
    const data = functionSelector("isBlacklisted(address)") + address.slice(2).toLowerCase().padStart(64, "0")
    const r = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: ARC.USDC, data }, "latest"] }),
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return { kind: "unavailable" }
    const body = (await r.json()) as { result?: string }
    if (typeof body.result !== "string" || !/^0x[0-9a-f]{64}$/i.test(body.result)) return { kind: "unavailable" }
    return { kind: "ok", blocklisted: BigInt(body.result) !== 0n }
  } catch {
    return { kind: "unavailable" }
  }
}

/**
 * Arc's own revert strings, as the chain returns them, explained in its
 * terms. Anything else returns null and takes the normal decoder path.
 */
export function arcRevertExplanation(reason: string): { explanation: string; fix: string } | null {
  const r = reason.trim()
  if (r === "Blocked address") {
    return {
      explanation: "An address in this transfer is on the USDC blocklist, so Arc refused the transfer. Because USDC is Arc's gas token, the gas used up to that check was still charged.",
      fix: "Retrying will not change the outcome. If you believe the restriction is wrong, contact the app or Circle; TxID cannot see why an address was restricted.",
    }
  }
  if (r === "Zero address not allowed") {
    return {
      explanation: "This tried to send USDC to the zero address. On Arc, USDC is the native token, and sending it to the zero address is refused rather than burned.",
      fix: "Check the recipient address and send it again to the address you intended.",
    }
  }
  return null
}
