import { CHAIN_CONFIGS } from "./types"
import { keccak256, functionSelector } from "./keccak"

// ENS lives on Ethereum mainnet regardless of where the user is transacting.
const ENS_REGISTRY = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e"

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "")
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  return out
}

/** EIP-137 namehash. Lowercases labels (sufficient for ASCII names). */
export function namehash(name: string): string {
  let node = "00".repeat(32)
  const trimmed = name.trim().toLowerCase()
  if (trimmed) {
    const labels = trimmed.split(".")
    for (let i = labels.length - 1; i >= 0; i--) {
      const labelHash = keccak256(new TextEncoder().encode(labels[i]!))
      node = keccak256(hexToBytes(node + labelHash))
    }
  }
  return "0x" + node
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: string }
    return json.result ?? null
  } catch {
    return null
  }
}

export interface EnsResolution {
  name: string
  address: string | null
  note?: string
}

/**
 * Resolve an ENS name (e.g. "vitalik.eth") to an address via the on-chain
 * registry + resolver on Ethereum mainnet. Returns address: null when the name
 * doesn't resolve; returns null only on infrastructure failure.
 */
export async function resolveEnsName(name: string): Promise<EnsResolution | null> {
  const rpcUrls = [
    CHAIN_CONFIGS["0x1"]?.rpcUrl,
    "https://ethereum-rpc.publicnode.com",
  ].filter((u): u is string => !!u)
  const node = namehash(name)

  for (const rpcUrl of rpcUrls) {
    // registry.resolver(bytes32) → resolver address
    const resolverRaw = await ethCall(rpcUrl, ENS_REGISTRY, functionSelector("resolver(bytes32)") + node.slice(2))
    if (resolverRaw === null) continue // try the next RPC
    const resolver = "0x" + resolverRaw.replace(/^0x/, "").slice(24, 64)
    if (/^0x0+$/.test(resolver)) {
      return { name, address: null, note: "This ENS name is not registered or has no resolver set." }
    }

    // resolver.addr(bytes32) → address
    const addrRaw = await ethCall(rpcUrl, resolver, functionSelector("addr(bytes32)") + node.slice(2))
    if (addrRaw === null) continue
    const address = "0x" + addrRaw.replace(/^0x/, "").slice(24, 64)
    if (/^0x0+$/.test(address)) {
      return { name, address: null, note: "This ENS name is registered but has no address record set." }
    }
    return { name, address }
  }
  return null
}
