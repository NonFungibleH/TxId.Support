import { CHAIN_CONFIGS } from "./types"
import { eventTopic0, functionSelector } from "./keccak"
import { decodeEventLog, decodeParams, type AbiParam } from "./abi"

// ERC-20 / ERC-721 Transfer(address,address,uint256) topic0.
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

async function rpc(rpcUrl: string, method: string, params: unknown[]): Promise<unknown> {
  try {
    const res = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as { result?: unknown }
    return json.result ?? null
  } catch {
    return null
  }
}

function gwei(wei: bigint): string {
  return (Number(wei) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 })
}

type AbiEntry = { type: string; name?: string; inputs?: AbiParam[] }
type RpcLog = { address: string; topics: string[]; data: string }

export interface TxEnrichment {
  method?: string
  methodArgs?: Record<string, string>
  events?: Array<{ name: string; params: Record<string, string> }>
  tokenTransfers?: Array<{ token: string; from: string; to: string; value: string }>
  confirmations?: number
  gas?: { effectiveGwei: string; baseFeeGwei?: string; verdict: "normal" | "overpaid" }
}

/**
 * Enrich a mined transaction with decoded call args, emitted events, ERC-20/721
 * token transfers, gas verdict, and confirmations — all via the chain's public
 * RPC and the contract ABI. Returns null on failure; never throws.
 */
export async function enrichTransaction(
  hash: string,
  chainId: string,
  abiJson: string | undefined,
): Promise<TxEnrichment | null> {
  try {
    const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
    if (!rpcUrl) return null

    const [txRaw, receiptRaw, latestRaw] = (await Promise.all([
      rpc(rpcUrl, "eth_getTransactionByHash", [hash]),
      rpc(rpcUrl, "eth_getTransactionReceipt", [hash]),
      rpc(rpcUrl, "eth_blockNumber", []),
    ])) as [
      { input?: string } | null,
      { logs?: RpcLog[]; blockNumber?: string; effectiveGasPrice?: string } | null,
      string | null,
    ]
    if (!receiptRaw) return null

    const out: TxEnrichment = {}

    // ── Decoded call + arguments ─────────────────────────────────────────────
    const input = txRaw?.input
    if (abiJson && input && input.length >= 10) {
      try {
        const abi = JSON.parse(abiJson) as AbiEntry[]
        const selector = input.slice(0, 10).toLowerCase()
        const fn = abi.find(
          f =>
            f.type === "function" &&
            !!f.name &&
            functionSelector(`${f.name}(${(f.inputs ?? []).map(i => i.type).join(",")})`).toLowerCase() === selector,
        )
        if (fn?.name) {
          out.method = fn.name
          if ((fn.inputs?.length ?? 0) > 0) {
            out.methodArgs = decodeParams(fn.inputs ?? [], "0x" + input.slice(10))
          }
        }
      } catch { /* ignore */ }
    }

    // ── Emitted events + token transfers ─────────────────────────────────────
    const logs = receiptRaw.logs ?? []
    const eventByTopic = new Map<string, AbiEntry>()
    if (abiJson) {
      try {
        const abi = JSON.parse(abiJson) as AbiEntry[]
        for (const e of abi) {
          if (e.type === "event" && e.name) {
            const sig = `${e.name}(${(e.inputs ?? []).map(i => i.type).join(",")})`
            eventByTopic.set(eventTopic0(sig).toLowerCase(), e)
          }
        }
      } catch { /* ignore */ }
    }

    const events: TxEnrichment["events"] = []
    const tokenTransfers: TxEnrichment["tokenTransfers"] = []
    for (const log of logs) {
      const t0 = (log.topics?.[0] ?? "").toLowerCase()
      if (t0 === TRANSFER_TOPIC && (log.topics?.length ?? 0) >= 3) {
        tokenTransfers.push({
          token: log.address,
          from: "0x" + log.topics[1]!.slice(26),
          to: "0x" + log.topics[2]!.slice(26),
          value: BigInt(log.data && log.data !== "0x" ? log.data : "0x0").toString(),
        })
        continue
      }
      const ev = eventByTopic.get(t0)
      if (ev) {
        const decoded = decodeEventLog(ev, log.topics ?? [], log.data ?? "0x")
        if (decoded) events.push(decoded)
      }
    }
    if (events.length) out.events = events.slice(0, 15)
    if (tokenTransfers.length) out.tokenTransfers = tokenTransfers.slice(0, 15)

    // ── Confirmations ────────────────────────────────────────────────────────
    if (latestRaw && receiptRaw.blockNumber) {
      const conf = Number(BigInt(latestRaw) - BigInt(receiptRaw.blockNumber))
      if (conf >= 0) out.confirmations = conf
    }

    // ── Gas verdict ──────────────────────────────────────────────────────────
    if (receiptRaw.effectiveGasPrice && receiptRaw.blockNumber) {
      const eff = BigInt(receiptRaw.effectiveGasPrice)
      const block = (await rpc(rpcUrl, "eth_getBlockByNumber", [receiptRaw.blockNumber, false])) as
        | { baseFeePerGas?: string }
        | null
      const baseFee = block?.baseFeePerGas ? BigInt(block.baseFeePerGas) : null
      out.gas = {
        effectiveGwei: gwei(eff),
        ...(baseFee ? { baseFeeGwei: gwei(baseFee) } : {}),
        verdict: baseFee && baseFee > 0n && eff > baseFee * 3n ? "overpaid" : "normal",
      }
    }

    return out
  } catch {
    return null
  }
}
