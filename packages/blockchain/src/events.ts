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
