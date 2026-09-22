import {
  CHAIN_CONFIGS,
  canonicalChainId,
  readWalletHistory,
  getNativeBalance,
  getTokenBalances,
  getAllowance,
  readNetworkStatus,
} from "@txid/blockchain"
import type { ProjectConfig, ActivationConfig } from "@/lib/types/config"
import type { WalletFacts, Read } from "./readiness"
import type { ProtocolHistory } from "./cohort"

/**
 * The reads behind the readiness checklist and the activation record.
 *
 * EVERY READ HERE IS TRI-STATE, and each catch below turns a failure into
 * `unavailable`, never into an empty list or a zero. The checklist then shows
 * "couldn't check", and the cohort changes nothing. A `.catch(() => [])` in
 * this file would tell a new user they hold no USDC because Moralis blinked.
 */

export interface ActionChain {
  id: string
  name: string
  nativeSymbol: string
  evm: boolean
}

/** Page size for history. A page shorter than this is the wallet's whole history. */
export const HISTORY_LIMIT = 100
/** Protocols deployed on more chains than this are read on their first few only. */
const MAX_HISTORY_CHAINS = 3
/**
 * Units of gas one first action is assumed to need. Generous on purpose: an
 * approve plus a supply on a lending market runs to about this, and an L2's
 * data fee is not in eth_gasPrice at all, so a tighter figure would call a
 * wallet ready that is not.
 */
const GAS_UNITS_ONE_TX = 300_000n
/** Where a token the user lacks on the action chain is most likely to be sitting instead. */
const COMMON_CHAINS = ["0x1", "0xa4b1", "0x2105", "0x38", "0x89", "0xa"]
const MAX_ELSEWHERE_READS = 4
/** A failed attempt older than this is history, not something to rescue. */
const RESCUE_WINDOW_MS = 24 * 60 * 60 * 1000

function evmChain(id: string): ActionChain | null {
  const c = CHAIN_CONFIGS[canonicalChainId(id)]
  if (!c) return null
  return { id: c.id, name: c.name, nativeSymbol: c.nativeCurrency, evm: true }
}

/**
 * The chain the first action happens on: the named contract's, else the first
 * watched EVM contract's. Null for a non-EVM protocol, which v1 does not cover.
 */
export function resolveActionChain(config: ProjectConfig): ActionChain | null {
  const a = config.activation
  const contracts = config.watchedContracts ?? []
  const named = a?.contractId ? contracts.find(c => c.id === a.contractId) : undefined
  if (named) return evmChain(String(named.chain))
  for (const c of contracts) {
    const chain = evmChain(String(c.chain))
    if (chain) return chain
  }
  return null
}

function spenderOf(config: ProjectConfig): string | null {
  const id = config.activation?.contractId
  if (!id) return null
  const c = (config.watchedContracts ?? []).find(w => w.id === id)
  return c?.address && /^0x[0-9a-fA-F]{40}$/.test(c.address) ? c.address : null
}

function watchedByChain(config: ProjectConfig): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>()
  for (const c of config.watchedContracts ?? []) {
    const id = canonicalChainId(String(c.chain ?? ""))
    if (!CHAIN_CONFIGS[id] || !c.address) continue
    const set = out.get(id) ?? new Set<string>()
    set.add(c.address.toLowerCase())
    out.set(id, set)
  }
  return out
}

/**
 * Transactions from the wallet to the protocol's watched contracts, newest
 * first, across the protocol's EVM chains.
 *
 * MERGING KEEPS THE WEAKEST CLAIM. The result is complete only when every
 * chain's read was complete, and a chain that could not be read makes the
 * whole thing incomplete with unknown coverage. A success seen on any chain is
 * still reported, because a success is proof whatever else was missed.
 */
export async function readProtocolHistory(config: ProjectConfig, address: string): Promise<ProtocolHistory> {
  const chains = Array.from(watchedByChain(config).entries()).slice(0, MAX_HISTORY_CHAINS)
  if (chains.length === 0) return { kind: "unsupported" }

  const reads = await Promise.all(chains.map(async ([chainId, watched]) => ({
    watched,
    read: await readWalletHistory(address, chainId, HISTORY_LIMIT).catch(() => ({ kind: "unavailable" as const })),
  })))
  if (reads.every(r => r.read.kind !== "ok")) {
    return reads.some(r => r.read.kind === "unavailable") ? { kind: "unavailable" } : { kind: "unsupported" }
  }

  let complete = true
  let oldestAt: string | null = null
  let coverageKnown = true
  const txs: Extract<ProtocolHistory, { kind: "ok" }>["txs"] = []
  for (const { watched, read } of reads) {
    if (read.kind !== "ok") { complete = false; coverageKnown = false; continue }
    if (!read.complete) {
      complete = false
      // The latest of the per-chain oldest dates is how far back EVERY chain reached.
      const oldest = read.txs.reduce<string | null>((o, t) => (!o || Date.parse(t.timestamp) < Date.parse(o) ? t.timestamp : o), null)
      if (!oldest) coverageKnown = false
      else if (!oldestAt || Date.parse(oldest) > Date.parse(oldestAt)) oldestAt = oldest
    }
    for (const t of read.txs) {
      if (!t.to || !watched.has(t.to.toLowerCase())) continue
      txs.push({
        hash: t.hash,
        at: t.timestamp,
        age: t.age,
        success: t.status === "success",
        ...(t.decodedRevert?.cause === "out_of_gas"
          ? { reason: "It ran out of gas. The gas limit set for it was too low for what it needed to do, which is a wallet setting, not your balance." }
          : {}),
      })
    }
  }
  txs.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
  return { kind: "ok", complete, oldestAt: coverageKnown ? oldestAt : null, txs }
}

/** The most recent attempt, when it failed recently and nothing has succeeded since. */
export function recentFailure(h: ProtocolHistory, now: number): WalletFacts["failure"] {
  if (h.kind !== "ok") return null
  const last = h.txs[0]
  if (!last || last.success) return null
  if (now - Date.parse(last.at) > RESCUE_WINDOW_MS) return null
  return { source: "history", when: last.age ?? null, ...(last.reason ? { reason: last.reason } : {}) }
}

async function readGas(address: string, chain: ActionChain): Promise<Read<{ hasAny: boolean; coversOneTx: boolean | null }>> {
  const [bal, net] = await Promise.all([
    getNativeBalance(address, chain.id).then(b => ({ ok: true as const, b }), () => ({ ok: false as const })),
    readNetworkStatus(chain.id).catch(() => ({ kind: "unavailable" as const })),
  ])
  if (!bal.ok) return { kind: "unavailable" }
  let wei: bigint
  try { wei = BigInt(bal.b.balance) } catch { return { kind: "unavailable" } }
  let coversOneTx: boolean | null = null
  const gwei = net.kind === "ok" ? Number(net.status.gasPriceGwei) : NaN
  if (Number.isFinite(gwei) && gwei > 0) {
    const priceWei = BigInt(Math.ceil(gwei * 1e9))
    coversOneTx = wei >= priceWei * GAS_UNITS_ONE_TX
  }
  return { kind: "ok", value: { hasAny: wei > 0n, coversOneTx } }
}

async function readAsset(
  address: string,
  chain: ActionChain,
  tokens: { address: string; symbol: string }[],
  config: ProjectConfig,
): Promise<{ asset: WalletFacts["asset"]; held: { address: string; symbol: string }[] }> {
  const wanted = tokens.map(t => t.symbol)
  let balances
  try { balances = await getTokenBalances(address, chain.id) } catch { return { asset: { kind: "unavailable" }, held: [] } }
  const want = new Map(tokens.map(t => [t.address.toLowerCase(), t]))
  const held = balances
    .filter(b => want.has(b.tokenAddress.toLowerCase()) && safeBig(b.balance) > 0n)
    .map(b => want.get(b.tokenAddress.toLowerCase())!)
  if (held.length > 0) return { asset: { kind: "ok", value: { held: held.map(h => h.symbol), wanted, elsewhere: [] } }, held }

  // Not on the action chain. Look on the protocol's other chains and the usual
  // places, by symbol. A chain whose read failed is simply not mentioned.
  const symbols = new Set(wanted.map(s => s.toUpperCase()))
  const candidates = Array.from(new Set([
    ...Array.from(watchedByChain(config).keys()),
    ...COMMON_CHAINS,
  ])).filter(id => id !== chain.id && CHAIN_CONFIGS[id]).slice(0, MAX_ELSEWHERE_READS)
  const found = await Promise.all(candidates.map(async id => {
    try {
      const bs = await getTokenBalances(address, id)
      const hit = bs.find(b => symbols.has(b.symbol.toUpperCase()) && safeBig(b.balance) > 0n)
      return hit ? { symbol: hit.symbol, chainName: CHAIN_CONFIGS[id]!.name } : null
    } catch { return null }
  }))
  const elsewhere = found.filter((x): x is { symbol: string; chainName: string } => x !== null)
  return { asset: { kind: "ok", value: { held: [], wanted, elsewhere } }, held: [] }
}

async function readApprovals(
  address: string,
  chain: ActionChain,
  held: { address: string; symbol: string }[],
  spender: string,
): Promise<WalletFacts["approvals"]> {
  const results = await Promise.all(held.slice(0, 2).map(async t => ({
    symbol: t.symbol,
    allowance: await getAllowance(t.address, address, spender, chain.id).catch(() => null),
  })))
  // getAllowance answers null for a node that did not reply. One unanswered
  // token makes the whole item "couldn't check", rather than half a claim.
  if (results.some(r => r.allowance === null)) return { kind: "unavailable" }
  return { kind: "ok", value: results.map(r => ({ symbol: r.symbol, approved: (r.allowance as bigint) > 0n })) }
}

function safeBig(s: string): bigint {
  try { return BigInt(s) } catch { return 0n }
}

export async function readWalletFacts(
  config: ProjectConfig,
  activation: ActivationConfig,
  address: string,
  walletChainId: string | null,
  chain: ActionChain,
  failure: WalletFacts["failure"],
): Promise<WalletFacts> {
  const walletChain = walletChainId
    ? { id: canonicalChainId(walletChainId), name: CHAIN_CONFIGS[canonicalChainId(walletChainId)]?.name ?? "another network" }
    : null

  const spends = activation.spends
  const [gas, assetRead] = await Promise.all([
    readGas(address, chain),
    spends.kind === "tokens" && spends.tokens.length > 0
      ? readAsset(address, chain, spends.tokens, config)
      : Promise.resolve({ asset: null, held: [] as { address: string; symbol: string }[] }),
  ])

  const spender = spenderOf(config)
  const approvals: WalletFacts["approvals"] =
    spends.kind === "tokens" && spender && assetRead.asset?.kind === "ok" && assetRead.held.length > 0
      ? await readApprovals(address, chain, assetRead.held, spender)
      : assetRead.asset?.kind === "unavailable" && spender
        ? { kind: "unavailable" }
        : null

  return { walletChain, gas, asset: assetRead.asset, approvals, failure }
}
