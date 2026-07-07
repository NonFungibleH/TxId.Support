import { CHAIN_CONFIGS } from "./types"
import { eventTopic0 } from "./keccak"

const MORALIS_BASE = "https://deep-index.moralis.io/api/v2.2"

function moralisChain(chainId: string): string {
  return CHAIN_CONFIGS[chainId]?.moralisChain ?? "eth"
}

function moralisHeaders(): Record<string, string> {
  const apiKey = process.env.MORALIS_API_KEY
  if (!apiKey) throw new Error("MORALIS_API_KEY is not set")
  return { "X-API-Key": apiKey, "Content-Type": "application/json" }
}

type AbiEntry = { type: string; name?: string; inputs?: Array<{ type: string; name?: string }> }

export interface ContractEvent {
  event: string
  timestamp: string    // ISO timestamp of the block
  blockNumber: string
  txHash: string
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
    const chain = moralisChain(chainId)
    const res = await fetch(
      `${MORALIS_BASE}/${contractAddress}/logs?chain=${chain}&topic0=${topic0}`,
      { headers: moralisHeaders(), signal: AbortSignal.timeout(9000) },
    )
    if (!res.ok) return []
    const json = (await res.json()) as {
      result?: Array<{ transaction_hash: string; block_timestamp: string; block_number: string }>
    }
    return (json.result ?? []).slice(0, limit).map(r => ({
      event: ev.name!,
      timestamp: r.block_timestamp,
      blockNumber: r.block_number,
      txHash: r.transaction_hash,
    }))
  } catch {
    return []
  }
}
