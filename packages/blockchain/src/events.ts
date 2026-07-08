import { eventTopic0 } from "./keccak"
import { getTransactionByHash } from "./wallet"
import { explorerQuery } from "./blockscout"
import { CHAIN_CONFIGS } from "./types"

/** Resolve a block's timestamp via RPC (used when the explorer omits it). */
async function blockTimestamp(chainId: string, block: string): Promise<string | null> {
  try {
    const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
    if (!rpcUrl) return null
    const blockHex = block.startsWith("0x") ? block : "0x" + Number(block).toString(16)
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getBlockByNumber", params: [blockHex, false] }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: { timestamp?: string } }
    const ts = json.result?.timestamp
    return ts ? new Date(parseInt(ts, 16) * 1000).toISOString() : null
  } catch {
    return null
  }
}

type AbiEntry = { type: string; name?: string; inputs?: Array<{ type: string; name?: string }> }

export interface ContractEvent {
  event: string
  timestamp: string    // ISO timestamp of the block
  blockNumber: string
  txHash: string
}

export interface ContractDeployment {
  deployer: string
  txHash: string
  timestamp: string | null   // ISO timestamp of the deployment, when resolvable
}

/**
 * Look up when a contract was deployed (created) and by whom, via Etherscan V2's
 * getcontractcreation. Resolves the deployment timestamp from the response, or
 * by fetching the creation transaction. Returns null on any failure.
 */
export async function getContractDeployment(
  contractAddress: string,
  chainId: string,
): Promise<ContractDeployment | null> {
  try {
    const r = await explorerQuery(chainId, {
      module: "contract", action: "getcontractcreation", contractaddresses: contractAddress,
    })
    if (!r || r.status !== "1" || !Array.isArray(r.result)) return null
    const row = r.result[0] as { contractCreator?: string; txHash?: string; timestamp?: string; blockNumber?: string } | undefined
    if (!row) return null
    let timestamp: string | null = null
    if (row.timestamp && /^\d+$/.test(row.timestamp)) {
      timestamp = new Date(Number(row.timestamp) * 1000).toISOString()
    } else if (row.txHash) {
      const tx = await getTransactionByHash(row.txHash, chainId).catch(() => null)
      timestamp = tx?.timestamp ?? null
    }
    if (!timestamp && row.blockNumber) timestamp = await blockTimestamp(chainId, row.blockNumber)
    return { deployer: row.contractCreator ?? "", txHash: row.txHash ?? "", timestamp }
  } catch {
    return null
  }
}

/** List the event names present in an ABI (for suggesting the right one). */
export function eventNamesFromAbi(abiJson: string | undefined): string[] {
  if (!abiJson) return []
  try {
    const abi = JSON.parse(abiJson) as AbiEntry[]
    return abi.filter(e => e.type === "event" && e.name).map(e => e.name!)
  } catch {
    return []
  }
}

/**
 * Read a contract's recent history for a named event (e.g. "FeesChanged").
 * Derives the event's topic0 from the uploaded ABI, then queries Moralis logs
 * (newest first). Returns [] if the ABI/event is unknown or the lookup fails —
 * never throws, so a bad response degrades to "no history found".
 */
export async function getContractEvents(
  contractAddress: string,
  chainId: string,
  eventName: string,
  abiJson: string | undefined,
  limit = 10,
): Promise<ContractEvent[]> {
  try {
    if (!abiJson) return []
    const abi = JSON.parse(abiJson) as AbiEntry[]
    const ev = abi.find(
      e => e.type === "event" && e.name?.toLowerCase() === eventName.toLowerCase(),
    )
    if (!ev?.name) return []
    const signature = `${ev.name}(${(ev.inputs ?? []).map(i => i.type).join(",")})`
    const topic0 = eventTopic0(signature)
    // getLogs is ascending by block, so the newest matches are at the end.
    const r = await explorerQuery(chainId, {
      module: "logs", action: "getLogs", address: contractAddress,
      topic0, fromBlock: "0", toBlock: "latest", page: "1", offset: "1000",
    })
    if (!r || r.status !== "1" || !Array.isArray(r.result)) return []
    const rows = r.result as Array<{ transactionHash: string; blockNumber: string; timeStamp: string }>
    return rows
      .slice(-limit)
      .reverse()
      .map(row => ({
        event: ev.name!,
        timestamp: new Date(parseInt(row.timeStamp, 16) * 1000).toISOString(),
        blockNumber: String(parseInt(row.blockNumber, 16)),
        txHash: row.transactionHash,
      }))
  } catch {
    return []
  }
}

// ── Contract verification / proxy info (Etherscan getsourcecode) ────────────

export interface ContractInfo {
  name?: string
  verified: boolean
  isProxy: boolean
  implementation?: string
  compiler?: string
}

/** Verification status, proxy flag, and implementation address for a contract. */
export async function getContractInfo(
  contractAddress: string,
  chainId: string,
): Promise<ContractInfo | null> {
  try {
    const r = await explorerQuery(chainId, { module: "contract", action: "getsourcecode", address: contractAddress })
    if (!r || r.status !== "1" || !Array.isArray(r.result)) return null
    const row = r.result[0] as
      | { ContractName?: string; Proxy?: string; Implementation?: string; CompilerVersion?: string; ABI?: string }
      | undefined
    if (!row) return null
    const verified = !!row.ABI && row.ABI !== "Contract source code not verified"
    return {
      ...(row.ContractName ? { name: row.ContractName } : {}),
      verified,
      isProxy: row.Proxy === "1",
      ...(row.Implementation && /^0x[0-9a-fA-F]{40}$/.test(row.Implementation) ? { implementation: row.Implementation } : {}),
      ...(row.CompilerVersion ? { compiler: row.CompilerVersion } : {}),
    }
  } catch {
    return null
  }
}

// EIP-1967 implementation slot (and legacy OpenZeppelin slot as a fallback).
const EIP1967_IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc"
const OZ_LEGACY_IMPL_SLOT = "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3"

/**
 * Read a proxy's implementation address from its EIP-1967 storage slot via RPC.
 * Chain-agnostic and keyless — works where the explorer's proxy flag doesn't
 * (notably the Blockscout fallback chains). Returns null when the slot is empty
 * (not a standard proxy).
 */
async function readProxyImplementation(address: string, chainId: string): Promise<string | null> {
  const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
  if (!rpcUrl) return null
  for (const slot of [EIP1967_IMPL_SLOT, OZ_LEGACY_IMPL_SLOT]) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getStorageAt", params: [address, slot, "latest"] }),
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const json = (await res.json()) as { result?: string }
      const raw = json.result?.replace(/^0x/, "") ?? ""
      if (raw.length < 64) continue
      const impl = "0x" + raw.slice(24) // last 20 bytes
      if (/^0x0+$/.test(impl)) continue
      return impl
    } catch {
      /* try next slot */
    }
  }
  return null
}

/**
 * Fetch a contract's ABI, and when it is a proxy, MERGE in the implementation's
 * ABI. A proxy's own ABI only exposes upgrade plumbing (Upgraded, admin,
 * upgradeTo) — the business interface (FeesChanged, paused, fee, lockTokens…)
 * lives in the implementation. Without this, event/state/decode tools read the
 * proxy ABI and can't see the real events or getters, so the bot wrongly says
 * "I don't have access to the event history". Returns the merged ABI JSON
 * string (implementation entries take precedence), the plain ABI when not a
 * proxy, or null. Never throws.
 */
export async function fetchAbiWithProxy(
  address: string,
  chainId: string,
  fetchAbi: (a: string, c: string) => Promise<string | null>,
): Promise<string | null> {
  const ownAbi = await fetchAbi(address, chainId).catch(() => null)
  // Resolve the implementation two ways: the explorer's proxy flag (reliable on
  // Etherscan, but NOT on the Blockscout fallback chains), and — as the robust
  // fallback — reading the EIP-1967 implementation storage slot directly via
  // RPC, which works on any chain regardless of the explorer.
  const info = await getContractInfo(address, chainId).catch(() => null)
  const implementation =
    (info?.isProxy && info.implementation ? info.implementation : null) ??
    (await readProxyImplementation(address, chainId).catch(() => null))
  if (!implementation) return ownAbi
  const implAbi = await fetchAbi(implementation, chainId).catch(() => null)
  if (!implAbi) return ownAbi
  try {
    const own = ownAbi ? (JSON.parse(ownAbi) as AbiEntry[]) : []
    const impl = JSON.parse(implAbi) as AbiEntry[]
    const seen = new Set<string>()
    const merged: AbiEntry[] = []
    // Implementation first so its entries win on any signature collision.
    for (const e of [...impl, ...own]) {
      const key = `${e.type}:${e.name ?? ""}:${(e.inputs ?? []).map(i => i.type).join(",")}`
      if (seen.has(key)) continue
      seen.add(key)
      merged.push(e)
    }
    return JSON.stringify(merged)
  } catch {
    return implAbi
  }
}

// ── Proxy upgrade history (Upgraded(address) events) ────────────────────────

export interface UpgradeEvent {
  implementation: string
  timestamp: string
  txHash: string
}

/** History of a proxy's implementation upgrades, newest first. */
export async function getUpgradeHistory(
  contractAddress: string,
  chainId: string,
): Promise<UpgradeEvent[]> {
  try {
    const topic0 = eventTopic0("Upgraded(address)")
    const r = await explorerQuery(chainId, {
      module: "logs", action: "getLogs", address: contractAddress,
      topic0, fromBlock: "0", toBlock: "latest", page: "1", offset: "100",
    })
    if (!r || r.status !== "1" || !Array.isArray(r.result)) return []
    const rows = r.result as Array<{ topics: string[]; timeStamp: string; transactionHash: string }>
    return rows
      .slice()
      .reverse()
      .slice(0, 20)
      .map(row => ({
        implementation: "0x" + (row.topics[1] ?? "").slice(26),
        timestamp: new Date(parseInt(row.timeStamp, 16) * 1000).toISOString(),
        txHash: row.transactionHash,
      }))
  } catch {
    return []
  }
}
