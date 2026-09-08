import { eventTopic0 } from "./keccak"
import { getTransactionByHash } from "./wallet"
import { explorerRead, explorerQuery } from "./blockscout"
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
    // Keyless RPC fallback: resolve the creation tx's block → timestamp directly
    // (Routescan/Avalanche returns the txHash but no timestamp or blockNumber,
    // and Moralis can miss old txs).
    if (!timestamp && row.txHash) {
      const rpcUrl = CHAIN_CONFIGS[chainId]?.rpcUrl
      if (rpcUrl) {
        try {
          const res = await fetch(rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [row.txHash] }),
            signal: AbortSignal.timeout(6000),
          })
          if (res.ok) {
            const json = (await res.json()) as { result?: { blockNumber?: string } }
            const bn = json.result?.blockNumber
            if (bn) timestamp = await blockTimestamp(chainId, bn)
          }
        } catch { /* leave timestamp null */ }
      }
    }
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

// Known signatures for common events, so we can compute topic0 and query the
// full history WITHOUT an ABI. Keyed by lowercased event name.
const COMMON_EVENT_SIGS: Record<string, string[]> = {
  paused: ["Paused(address)", "Paused()"],
  unpaused: ["Unpaused(address)", "Unpaused()"],
  ownershiptransferred: ["OwnershipTransferred(address,address)"],
  transfer: ["Transfer(address,address,uint256)"],
  approval: ["Approval(address,address,uint256)"],
  upgraded: ["Upgraded(address)"],
  adminchanged: ["AdminChanged(address,address)"],
  rolegranted: ["RoleGranted(bytes32,address,address)"],
  rolerevoked: ["RoleRevoked(bytes32,address,address)"],
  deposit: ["Deposit(address,uint256)", "Deposit(address,uint256,uint256)"],
  withdraw: ["Withdraw(address,uint256)", "Withdrawal(address,uint256)"],
  withdrawal: ["Withdrawal(address,uint256)"],
}

/**
 * Whether we can actually CHECK for a named event — true if it's in the ABI or
 * a known common event. When false, an empty result means "couldn't verify"
 * (needs the implementation ABI), NOT "never happened" — the caller must not
 * claim the event never fired.
 */
export function canCheckEvent(eventName: string, abiJson: string | undefined): boolean {
  if (COMMON_EVENT_SIGS[eventName.toLowerCase()]) return true
  if (!abiJson) return false
  try {
    const abi = JSON.parse(abiJson) as AbiEntry[]
    return abi.some(e => e.type === "event" && e.name?.toLowerCase() === eventName.toLowerCase())
  } catch {
    return false
  }
}

/** Query a contract's log history for one specific topic0 (full range). */
async function logsForTopic(
  contractAddress: string,
  chainId: string,
  topic0: string,
  eventLabel: string,
  limit: number,
): Promise<{ hits: ContractEvent[] } | { unavailable: string }> {
  const r = await explorerRead(chainId, {
    module: "logs", action: "getLogs", address: contractAddress,
    topic0, fromBlock: "0", toBlock: "latest", page: "1", offset: "1000",
  })
  if (r.kind === "unavailable") return { unavailable: r.reason }
  if (r.kind === "empty") return { hits: [] }
  if (!Array.isArray(r.result)) return { unavailable: "the explorer returned logs in an unexpected shape" }
  const rows = r.result as Array<{ transactionHash: string; blockNumber: string; timeStamp: string }>
  return {
    hits: rows.slice(-limit).reverse().map(row => ({
      event: eventLabel,
      timestamp: new Date(parseInt(row.timeStamp, 16) * 1000).toISOString(),
      blockNumber: String(parseInt(row.blockNumber, 16)),
      txHash: row.transactionHash,
    })),
  }
}

export type ContractEventsLookup =
  | { status: "ok"; events: ContractEvent[] }
  | { status: "unavailable"; reason: string }

/**
 * Read a contract's recent history for a named event (e.g. "FeesChanged").
 *
 * Two paths, so this works even without a complete ABI:
 *  1. ABI path — when the event is in the uploaded ABI, derive its exact topic0
 *     and query logs filtered to it (precise, cheap).
 *  2. ABI-free fallback — otherwise scan the contract's raw event log, resolve
 *     each distinct topic0 via 4byte.directory, and return the occurrences whose
 *     resolved name matches the requested event. This answers "has it ever been
 *     paused" / "when was the fee changed" from what ACTUALLY fired on-chain,
 *     even when the event isn't in the stored ABI (e.g. an un-merged proxy).
 *
 * AN EMPTY RESULT IS ONLY AN ANSWER IF AN EXPLORER ACTUALLY ANSWERED. This
 * used to return [] for both "the event never fired" and "the explorer was
 * unreachable", and the doc comment above said so out loud in a parenthetical
 * while the tool arm reported `count: 0, checked: true`. So "has this contract
 * ever been paused?" answered "no, never" during an outage, and, because
 * ETHERSCAN_API_KEY is unset in production and Ethereum has no Blockscout
 * fallback, on every mainnet call. `checked: true` made it an explicit claim
 * that we had looked.
 *
 * The ABI-missing case was already handled carefully in the tool arm ("do NOT
 * let the model claim it never fired"). This is the same care for the case
 * where the explorer, rather than the ABI, is what we did not have.
 */
export async function getContractEvents(
  contractAddress: string,
  chainId: string,
  eventName: string,
  abiJson: string | undefined,
  limit = 10,
): Promise<ContractEventsLookup> {
  // Any explorer read that did not complete poisons an empty result: we cannot
  // say the event never fired if one of the queries never ran.
  let failure: string | null = null
  try {
    // ── Path 1: exact topic0 from the ABI ──────────────────────────────────
    let topic0: string | null = null
    let resolvedName = eventName
    if (abiJson) {
      try {
        const abi = JSON.parse(abiJson) as AbiEntry[]
        const ev = abi.find(e => e.type === "event" && e.name?.toLowerCase() === eventName.toLowerCase())
        if (ev?.name) {
          topic0 = eventTopic0(`${ev.name}(${(ev.inputs ?? []).map(i => i.type).join(",")})`)
          resolvedName = ev.name
        }
      } catch { /* fall through to scan */ }
    }

    if (topic0) {
      const r = await logsForTopic(contractAddress, chainId, topic0, resolvedName, limit)
      if ("unavailable" in r) failure = r.unavailable
      else if (r.hits.length > 0) return { status: "ok", events: r.hits }
      // Fall through: 0 hits could be genuine, but also fall back to candidate
      // signatures in case the ABI's arg types produced a different topic0.
    }

    // ── Path 2: ABI-free — compute topic0 from known signatures of the named
    // event and query each (full history, precise). Answers "has it ever been
    // paused" / OwnershipTransferred / Transfer etc. even with no ABI.
    const candidates = COMMON_EVENT_SIGS[eventName.toLowerCase()]
    if (candidates) {
      for (const sig of candidates) {
        const r = await logsForTopic(contractAddress, chainId, eventTopic0(sig), eventNameOf(sig), limit)
        if ("unavailable" in r) failure = r.unavailable
        else if (r.hits.length > 0) return { status: "ok", events: r.hits }
      }
    }
    if (failure) return { status: "unavailable", reason: failure }
    return { status: "ok", events: [] }
  } catch {
    return { status: "unavailable", reason: "the event-log lookup did not complete" }
  }
}

const eventNameOf = (sig: string) => sig.slice(0, sig.indexOf("(") >= 0 ? sig.indexOf("(") : sig.length)

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
      // EVM-only by design: proxy implementations are an EVM concept (no Aptos path reaches this).
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
  /** Null when the log carried no readable address (see upgradedImplementation). */
  implementation: string | null
  timestamp: string
  txHash: string
}

const ADDRESS_RE = /^[0-9a-fA-F]{40}$/

/**
 * The implementation address out of an `Upgraded` log.
 *
 * `Upgraded(address)` hashes to the SAME topic0 whether or not its parameter is
 * indexed, so the argument may arrive in either place and the topic cannot tell
 * you which. OpenZeppelin's own proxies declare it indexed and put it in
 * topics[1]; others declare it plain and put it in `data`. Reading topics[1]
 * alone produced the literal string "0x" for the second kind, which is not an
 * address, reads like a burn address, and was rendered to the user as the
 * contract's new implementation. Observed live on USDC on Base, whose logs come
 * back as `topics: [topic0, null, null, null]` with the address in `data`.
 *
 * Returns null rather than a malformed address when neither carries one. The
 * upgrade still happened, so it is still reported; we just cannot name what it
 * pointed at, and saying so is the honest floor.
 */
function upgradedImplementation(row: { topics?: (string | null)[]; data?: string }): string | null {
  const fromTopic = (row.topics?.[1] ?? "").replace(/^0x/, "")
  if (fromTopic.length === 64 && ADDRESS_RE.test(fromTopic.slice(24))) return "0x" + fromTopic.slice(24)
  const fromData = (row.data ?? "").replace(/^0x/, "")
  if (fromData.length >= 64 && ADDRESS_RE.test(fromData.slice(24, 64))) return "0x" + fromData.slice(24, 64)
  return null
}

/**
 * History of a proxy's implementation upgrades, newest first, or an honest
 * statement that we could not find out.
 *
 * THE EMPTY ARRAY WAS A LIE, exactly as it was for approvals in #71, and this
 * one was worse because it was wrong on EVERY call in production rather than
 * only during an outage. `ETHERSCAN_API_KEY` is unset in prod; Etherscan V2
 * answers an unkeyed request with HTTP 200 and status "0"; Ethereum has no
 * Blockscout fallback configured; so the old code returned [] and the tool
 * reported `count: 0`. Verified live on 2026-09-08 against USDC, a proxy that
 * has been upgraded several times, which the assistant would have described as
 * never upgraded.
 *
 * "Has this contract been upgraded?" is asked by somebody who thinks the code
 * changed underneath them, and an all-clear is the answer that stops them
 * looking. A question we did not manage to ask must never render as a finding
 * of no upgrades.
 *
 * `none` is a real finding. `unavailable` is our failure. The caller has to be
 * able to tell them apart.
 */
export type UpgradeHistoryLookup =
  | { status: "ok"; upgrades: UpgradeEvent[] }
  | { status: "unavailable"; reason: string }

export async function getUpgradeHistory(
  contractAddress: string,
  chainId: string,
): Promise<UpgradeHistoryLookup> {
  try {
    const topic0 = eventTopic0("Upgraded(address)")
    const r = await explorerRead(chainId, {
      module: "logs", action: "getLogs", address: contractAddress,
      topic0, fromBlock: "0", toBlock: "latest", page: "1", offset: "100",
    })
    if (r.kind === "unavailable") return { status: "unavailable", reason: r.reason }
    // An explorer that answered and holds no Upgraded(address) logs IS the
    // finding: this proxy has not been upgraded, or is not a proxy at all.
    if (r.kind === "empty") return { status: "ok", upgrades: [] }
    if (!Array.isArray(r.result)) {
      return { status: "unavailable", reason: "the explorer returned logs in an unexpected shape" }
    }
    const rows = r.result as Array<{ topics: (string | null)[]; data?: string; timeStamp: string; transactionHash: string }>
    return {
      status: "ok",
      upgrades: rows
        .slice()
        .reverse()
        .slice(0, 20)
        .map(row => ({
          implementation: upgradedImplementation(row),
          timestamp: new Date(parseInt(row.timeStamp, 16) * 1000).toISOString(),
          txHash: row.transactionHash,
        })),
    }
  } catch {
    // A throw is our failure, and it is not evidence about the contract.
    return { status: "unavailable", reason: "the upgrade-history lookup did not complete" }
  }
}
