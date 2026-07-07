import { eventTopic0 } from "./keccak"
import { getTransactionByHash } from "./wallet"

const ETHERSCAN_V2_BASE = "https://api.etherscan.io/v2/api"
// Same numeric chain IDs the decoder uses for Etherscan V2.
const ETHERSCAN_CHAIN_IDS: Record<string, number> = {
  "0x1": 1, "0x2105": 8453, "0x38": 56, "0x89": 137, "0xa4b1": 42161, "0xa": 10, "0xaa36a7": 11155111,
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
    const numericChainId = ETHERSCAN_CHAIN_IDS[chainId]
    if (numericChainId === undefined) return null
    const apiKey = process.env.ETHERSCAN_API_KEY ?? ""
    const url =
      `${ETHERSCAN_V2_BASE}?chainid=${numericChainId}&module=contract&action=getcontractcreation` +
      `&contractaddresses=${contractAddress}${apiKey ? `&apikey=${apiKey}` : ""}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = (await res.json()) as {
      status: string
      result?: Array<{ contractCreator: string; txHash: string; timestamp?: string }>
    }
    const row = data.status === "1" ? data.result?.[0] : undefined
    if (!row) return null
    let timestamp: string | null = null
    if (row.timestamp && /^\d+$/.test(row.timestamp)) {
      timestamp = new Date(Number(row.timestamp) * 1000).toISOString()
    } else {
      const tx = await getTransactionByHash(row.txHash, chainId).catch(() => null)
      timestamp = tx?.timestamp ?? null
    }
    return { deployer: row.contractCreator, txHash: row.txHash, timestamp }
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
    const numericChainId = ETHERSCAN_CHAIN_IDS[chainId]
    if (numericChainId === undefined) return []
    const apiKey = process.env.ETHERSCAN_API_KEY ?? ""
    // Etherscan V2 getLogs — proven working with our key. Ascending by block, so
    // the newest matches are at the end; we take the tail and reverse.
    const url =
      `${ETHERSCAN_V2_BASE}?chainid=${numericChainId}&module=logs&action=getLogs` +
      `&address=${contractAddress}&topic0=${topic0}&fromBlock=0&toBlock=latest&page=1&offset=1000` +
      (apiKey ? `&apikey=${apiKey}` : "")
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = (await res.json()) as {
      status: string
      result?: Array<{ transactionHash: string; blockNumber: string; timeStamp: string }>
    }
    if (data.status !== "1" || !Array.isArray(data.result)) return []
    return data.result
      .slice(-limit)
      .reverse()
      .map(r => ({
        event: ev.name!,
        timestamp: new Date(parseInt(r.timeStamp, 16) * 1000).toISOString(),
        blockNumber: String(parseInt(r.blockNumber, 16)),
        txHash: r.transactionHash,
      }))
  } catch {
    return []
  }
}
