import { CHAIN_CONFIGS } from "./types"
import { eventTopic0, functionSelector } from "./keccak"
import { decodeEventLog, decodeParams, type AbiParam } from "./abi"

// Transfer(address,address,uint256) — ERC-20 value or ERC-721 tokenId.
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"

// Well-known events decoded even without the emitting contract's ABI. topic0 is
// derived at load time from the signature (no hardcoded hashes).
const STANDARD_EVENTS: Array<{ name: string; inputs: AbiParam[] }> = [
  { name: "Approval", inputs: [{ name: "owner", type: "address", indexed: true }, { name: "spender", type: "address", indexed: true }, { name: "value", type: "uint256" }] },
  { name: "ApprovalForAll", inputs: [{ name: "owner", type: "address", indexed: true }, { name: "operator", type: "address", indexed: true }, { name: "approved", type: "bool" }] },
  { name: "OwnershipTransferred", inputs: [{ name: "previousOwner", type: "address", indexed: true }, { name: "newOwner", type: "address", indexed: true }] },
  { name: "TransferSingle", inputs: [{ name: "operator", type: "address", indexed: true }, { name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "id", type: "uint256" }, { name: "value", type: "uint256" }] },
  { name: "Paused", inputs: [{ name: "account", type: "address" }] },
  { name: "Unpaused", inputs: [{ name: "account", type: "address" }] },
]

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

/** Look up an event signature by topic0 on 4byte.directory. */
async function lookupEventSig(topic0: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://www.4byte.directory/api/v1/event-signatures/?hex_signature=${topic0}`,
      { signal: AbortSignal.timeout(4000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as { results?: Array<{ text_signature: string }> }
    return data.results?.[data.results.length - 1]?.text_signature ?? null
  } catch {
    return null
  }
}

/** Read a token's symbol + decimals via eth_call (best-effort). */
async function tokenMeta(rpcUrl: string, token: string): Promise<{ symbol?: string; decimals?: number }> {
  try {
    const [symRaw, decRaw] = await Promise.all([
      rpc(rpcUrl, "eth_call", [{ to: token, data: functionSelector("symbol()") }, "latest"]),
      rpc(rpcUrl, "eth_call", [{ to: token, data: functionSelector("decimals()") }, "latest"]),
    ])
    const meta: { symbol?: string; decimals?: number } = {}
    if (typeof decRaw === "string" && decRaw !== "0x") meta.decimals = Number(BigInt(decRaw))
    if (typeof symRaw === "string" && symRaw.length > 2) {
      const hex = symRaw.replace(/^0x/, "")
      // dynamic string: [offset][len][data]; fall back to raw bytes32
      try {
        const len = Number(BigInt("0x" + hex.slice(64, 128)))
        const s = Buffer.from(hex.slice(128, 128 + len * 2), "hex").toString("utf-8").trim()
        meta.symbol = s || Buffer.from(hex, "hex").toString("utf-8").replace(/\0/g, "").trim()
      } catch {
        meta.symbol = Buffer.from(hex, "hex").toString("utf-8").replace(/\0/g, "").trim()
      }
    }
    return meta
  } catch {
    return {}
  }
}

function formatUnits(raw: string, decimals?: number): string | undefined {
  if (decimals === undefined) return undefined
  try {
    const v = BigInt(raw)
    const d = BigInt(decimals)
    const base = 10n ** d
    const whole = v / base
    const frac = (v % base).toString().padStart(decimals, "0").replace(/0+$/, "").slice(0, 6)
    return frac ? `${whole.toString()}.${frac}` : whole.toString()
  } catch {
    return undefined
  }
}

type AbiEntry = { type: string; name?: string; inputs?: AbiParam[] }
type RpcLog = { address: string; topics: string[]; data: string }

export interface TxEnrichment {
  method?: string
  methodArgs?: Record<string, string>
  events?: Array<{ name: string; contract: string; params?: Record<string, string>; inferred?: boolean; topic0?: string }>
  tokenTransfers?: Array<{ token: string; symbol?: string; from: string; to: string; value: string; valueFormatted?: string; kind: "erc20" | "erc721" | "erc1155" }>
  confirmations?: number
  gas?: { effectiveGwei: string; baseFeeGwei?: string; verdict: "normal" | "overpaid"; l1DataFeeNative?: string }
  logCount?: number
}

/**
 * Enrich a mined transaction with the most complete decode we can produce:
 * the call + arguments, EVERY event it emitted (decoded against the provided
 * ABIs, a standard-event library, or a 4byte fallback), all ERC-20/721/1155
 * token transfers with resolved symbols/decimals, gas verdict, and confirmations.
 * All via the chain's public RPC. Returns null on failure; never throws.
 */
export async function enrichTransaction(
  hash: string,
  chainId: string,
  abis: string[],
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
      { logs?: RpcLog[]; blockNumber?: string; effectiveGasPrice?: string; l1Fee?: string } | null,
      string | null,
    ]
    if (!receiptRaw) return null

    // Parse all ABIs once.
    const parsedAbis: AbiEntry[] = []
    for (const a of abis) {
      try {
        const p = JSON.parse(a) as AbiEntry[]
        if (Array.isArray(p)) parsedAbis.push(...p)
      } catch { /* ignore */ }
    }

    const out: TxEnrichment = {}

    // ── Decoded call + arguments (match selector across all ABIs) ─────────────
    const input = txRaw?.input
    if (input && input.length >= 10) {
      const selector = input.slice(0, 10).toLowerCase()
      const fn = parsedAbis.find(
        f => f.type === "function" && !!f.name &&
          functionSelector(`${f.name}(${(f.inputs ?? []).map(i => i.type).join(",")})`).toLowerCase() === selector,
      )
      if (fn?.name) {
        out.method = fn.name
        if ((fn.inputs?.length ?? 0) > 0) out.methodArgs = decodeParams(fn.inputs ?? [], "0x" + input.slice(10))
      }
    }

    // ── Build the event topic → ABI map (ABIs first, then standard events) ────
    const eventByTopic = new Map<string, AbiEntry>()
    for (const e of parsedAbis) {
      if (e.type === "event" && e.name) {
        const t0 = eventTopic0(`${e.name}(${(e.inputs ?? []).map(i => i.type).join(",")})`).toLowerCase()
        if (!eventByTopic.has(t0)) eventByTopic.set(t0, e)
      }
    }
    for (const e of STANDARD_EVENTS) {
      const t0 = eventTopic0(`${e.name}(${e.inputs.map(i => i.type).join(",")})`).toLowerCase()
      if (!eventByTopic.has(t0)) eventByTopic.set(t0, { type: "event", name: e.name, inputs: e.inputs })
    }

    const logs = receiptRaw.logs ?? []
    out.logCount = logs.length
    const events: NonNullable<TxEnrichment["events"]> = []
    const tokenTransfers: NonNullable<TxEnrichment["tokenTransfers"]> = []
    const unknown: RpcLog[] = []

    for (const log of logs) {
      const topics = log.topics ?? []
      const t0 = (topics[0] ?? "").toLowerCase()

      // ERC-20 / ERC-721 Transfer
      if (t0 === TRANSFER_TOPIC && topics.length >= 3) {
        if (topics.length === 4) {
          tokenTransfers.push({ token: log.address, from: "0x" + topics[1]!.slice(26), to: "0x" + topics[2]!.slice(26), value: BigInt(topics[3]!).toString(), kind: "erc721" })
        } else {
          tokenTransfers.push({ token: log.address, from: "0x" + topics[1]!.slice(26), to: "0x" + topics[2]!.slice(26), value: BigInt(log.data && log.data !== "0x" ? log.data : "0x0").toString(), kind: "erc20" })
        }
        continue
      }

      const ev = eventByTopic.get(t0)
      if (ev) {
        const d = decodeEventLog(ev, topics, log.data ?? "0x")
        if (d) {
          if (d.name === "TransferSingle" && d.params.from && d.params.to) {
            tokenTransfers.push({ token: log.address, from: d.params.from, to: d.params.to, value: d.params.value ?? "0", kind: "erc1155" })
          } else {
            events.push({ name: d.name, contract: log.address, params: d.params })
          }
        }
        continue
      }
      unknown.push(log)
    }

    // ── 4byte fallback for unknown event topics (dedup, capped, parallel) ──────
    const uniqueTopics = [...new Set(unknown.map(l => (l.topics?.[0] ?? "").toLowerCase()).filter(Boolean))].slice(0, 10)
    const sigByTopic = new Map<string, string>()
    await Promise.all(uniqueTopics.map(async t0 => {
      const sig = await lookupEventSig(t0)
      if (sig) sigByTopic.set(t0, sig)
    }))
    for (const log of unknown) {
      const topics = log.topics ?? []
      const t0 = (topics[0] ?? "").toLowerCase()
      const sig = sigByTopic.get(t0)
      const m = sig?.match(/^([^(]+)\((.*)\)$/)
      if (m) {
        const name = m[1]!
        const types = m[2] ? m[2].split(",").map(s => s.trim()).filter(Boolean) : []
        const numIndexed = Math.max(0, topics.length - 1)
        const inputs: AbiParam[] = types.map((type, i) => ({ type, indexed: i < numIndexed, name: `arg${i}` }))
        const d = decodeEventLog({ name, inputs }, topics, log.data ?? "0x")
        if (d) events.push({ name: d.name, contract: log.address, params: d.params, inferred: true })
      } else {
        events.push({ name: "UnknownEvent", contract: log.address, topic0: t0 })
      }
    }

    // ── Resolve token symbols/decimals for readable amounts ───────────────────
    const uniqueTokens = [...new Set(tokenTransfers.filter(t => t.kind !== "erc721").map(t => t.token.toLowerCase()))].slice(0, 10)
    const metaByToken = new Map<string, { symbol?: string; decimals?: number }>()
    await Promise.all(uniqueTokens.map(async t => { metaByToken.set(t, await tokenMeta(rpcUrl, t)) }))
    for (const tt of tokenTransfers) {
      const meta = metaByToken.get(tt.token.toLowerCase())
      if (meta?.symbol) tt.symbol = meta.symbol
      const fmt = tt.kind === "erc20" ? formatUnits(tt.value, meta?.decimals) : undefined
      if (fmt) tt.valueFormatted = fmt
    }

    if (events.length) out.events = events.slice(0, 20)
    if (tokenTransfers.length) out.tokenTransfers = tokenTransfers.slice(0, 20)

    // ── Confirmations ────────────────────────────────────────────────────────
    if (latestRaw && receiptRaw.blockNumber) {
      const conf = Number(BigInt(latestRaw) - BigInt(receiptRaw.blockNumber))
      if (conf >= 0) out.confirmations = conf
    }

    // ── Gas verdict ──────────────────────────────────────────────────────────
    if (receiptRaw.effectiveGasPrice && receiptRaw.blockNumber) {
      const eff = BigInt(receiptRaw.effectiveGasPrice)
      const block = (await rpc(rpcUrl, "eth_getBlockByNumber", [receiptRaw.blockNumber, false])) as { baseFeePerGas?: string } | null
      const baseFee = block?.baseFeePerGas ? BigInt(block.baseFeePerGas) : null
      // OP-stack chains (Base, Optimism) charge an L1 data fee ON TOP of the
      // L2 execution fee — receipts expose it as l1Fee. Surface it so "why did
      // I pay more than gasLimit × gasPrice?" is answerable.
      const l1Fee = receiptRaw.l1Fee ? BigInt(receiptRaw.l1Fee) : null
      out.gas = {
        effectiveGwei: gwei(eff),
        ...(baseFee ? { baseFeeGwei: gwei(baseFee) } : {}),
        verdict: baseFee && baseFee > 0n && eff > baseFee * 3n ? "overpaid" : "normal",
        ...(l1Fee && l1Fee > 0n ? { l1DataFeeNative: (Number(l1Fee) / 1e18).toFixed(8) } : {}),
      }
    }

    return out
  } catch {
    return null
  }
}
