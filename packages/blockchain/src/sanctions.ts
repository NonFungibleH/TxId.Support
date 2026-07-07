import { CHAIN_CONFIGS } from "./types"
import { functionSelector } from "./keccak"
import { encodeStaticArg } from "./abi"

// OFAC sanctions screening via the Chainalysis on-chain sanctions oracle, which
// Chainalysis maintains from the OFAC SDN list and deploys at the same address
// across major chains. We query the authoritative Ethereum mainnet deployment
// (sanctions are address-based, not chain-specific). Validated live: a known
// SDN address returns true, clean addresses return false, and delisted entries
// (e.g. Tornado Cash contracts, removed by OFAC in 2025) correctly return false.

const SANCTIONS_ORACLE = "0x40C57923924B5c5c5455c48D93317139ADDaC8fb"

// Try the configured Ethereum RPC first, then a reliable public fallback.
const ETH_RPCS = [CHAIN_CONFIGS["0x1"]?.rpcUrl, "https://ethereum-rpc.publicnode.com"].filter(
  (u): u is string => !!u,
)

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string | null> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      signal: AbortSignal.timeout(7000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: string }
    return json.result ?? null
  } catch {
    return null
  }
}

export interface SanctionsResult {
  address: string
  sanctioned: boolean
  source: string
}

/**
 * Check whether an address is OFAC-sanctioned via the Chainalysis on-chain
 * oracle. Returns null if the address is malformed or the check couldn't run
 * (so the caller can say "couldn't screen" rather than a false "clean").
 */
export async function checkSanctioned(address: string): Promise<SanctionsResult | null> {
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) return null
  const data = functionSelector("isSanctioned(address)") + encodeStaticArg("address", address)
  for (const rpcUrl of ETH_RPCS) {
    const raw = await ethCall(rpcUrl, SANCTIONS_ORACLE, data)
    if (raw && raw !== "0x") {
      let sanctioned = false
      try { sanctioned = BigInt(raw) === 1n } catch { /* keep false */ }
      return { address, sanctioned, source: "Chainalysis on-chain oracle (OFAC SDN list)" }
    }
  }
  return null
}
