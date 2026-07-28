import type { AbortErrmap } from "./abort"
import { decodeAbort } from "./abort"
import { normalizeAptosAddress } from "./address"
import type { AptosModuleAbi, AptosModuleFunction, AptosTransaction } from "./types"

const FULLNODE_BASE = "https://fullnode.mainnet.aptoslabs.com/v1"

export function aptosAuthHeaders(): Record<string, string> {
  return process.env.APTOS_API_KEY ? { Authorization: `Bearer ${process.env.APTOS_API_KEY}` } : {}
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// single polite retry on 429; long Retry-After means the quota window is exhausted, so bail instead of blocking callers
export async function aptosFetch(url: string, init: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
    if (res.status !== 429) return res
    const retryAfter = Number(res.headers.get("retry-after"))
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000
    if (waitMs > 10_000) return res
    await sleep(waitMs)
    return await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) })
  } catch {
    return null
  }
}

export async function aptosGet<T>(path: string): Promise<T | null> {
  const res = await aptosFetch(`${FULLNODE_BASE}${path}`, { headers: { ...aptosAuthHeaders() } })
  if (!res || !res.ok) return null
  try {
    return (await res.json()) as T
  } catch {
    return null
  }
}

export interface AptosLedgerInfo {
  chainId: number
  ledgerVersion: string
  ledgerTimestamp: string
}

export async function getLedgerInfo(): Promise<AptosLedgerInfo | null> {
  const info = await aptosGet<{ chain_id: number; ledger_version: string; ledger_timestamp: string }>("/")
  if (!info) return null
  return { chainId: info.chain_id, ledgerVersion: info.ledger_version, ledgerTimestamp: info.ledger_timestamp }
}

export async function getAccount(address: string): Promise<{ sequenceNumber: string } | null> {
  // /accounts/{addr} returns a synthetic stub (seq 0) for never-created addresses since AIP-115,
  // so existence is detected via the account resource, which still 404s
  const acct = await aptosGet<{ data?: { sequence_number: string } }>(
    `/accounts/${normalizeAptosAddress(address)}/resource/0x1::account::Account`
  )
  return acct?.data ? { sequenceNumber: acct.data.sequence_number } : null
}

interface RawExposedFunction {
  name: string
  is_entry: boolean
  is_view: boolean
  params: string[]
  generic_type_params: unknown[]
}

interface RawModule {
  abi?: {
    address: string
    name: string
    exposed_functions: RawExposedFunction[]
  }
}

function isSignerParam(param: string): boolean {
  return param === "signer" || param === "&signer"
}

function mapModule(raw: RawModule): AptosModuleAbi | null {
  const abi = raw.abi
  if (!abi) return null
  const functions: AptosModuleFunction[] = abi.exposed_functions.map(f => ({
    name: f.name,
    isEntry: f.is_entry,
    isView: f.is_view,
    params: f.params.filter(p => !isSignerParam(p)),
    genericTypeParams: f.generic_type_params.length,
  }))
  return { address: abi.address, moduleName: abi.name, functions }
}

export async function getAptosModuleAbi(address: string, moduleName: string): Promise<AptosModuleAbi | null>
export async function getAptosModuleAbi(address: string): Promise<AptosModuleAbi[] | null>
export async function getAptosModuleAbi(
  address: string,
  moduleName?: string
): Promise<AptosModuleAbi | AptosModuleAbi[] | null> {
  const addr = normalizeAptosAddress(address)
  if (moduleName) {
    const raw = await aptosGet<RawModule>(`/accounts/${addr}/module/${moduleName}`)
    return raw ? mapModule(raw) : null
  }
  // Paginate via the x-aptos-cursor header: large packages exceed any single
  // page (Decibel publishes 91 modules; the old limit=25 silently truncated).
  // Hard page cap keeps a pathological account from looping forever.
  const all: RawModule[] = []
  let cursor: string | null = null
  for (let page = 0; page < 6; page++) {
    const qs = `limit=100${cursor ? `&start=${encodeURIComponent(cursor)}` : ""}`
    const res = await aptosFetch(`${FULLNODE_BASE}/accounts/${addr}/modules?${qs}`, { headers: { ...aptosAuthHeaders() } })
    if (!res || !res.ok) return page === 0 ? null : all.map(mapModule).filter((m): m is AptosModuleAbi => m !== null)
    let raws: RawModule[]
    try {
      raws = (await res.json()) as RawModule[]
    } catch {
      return page === 0 ? null : all.map(mapModule).filter((m): m is AptosModuleAbi => m !== null)
    }
    all.push(...raws)
    cursor = res.headers.get("x-aptos-cursor")
    if (!cursor || raws.length === 0) break
  }
  return all.map(mapModule).filter((m): m is AptosModuleAbi => m !== null)
}

interface RawUserTransaction {
  type: string
  hash: string
  version: string
  success: boolean
  vm_status: string
  timestamp: string
  sender: string
  gas_used: string
  gas_unit_price: string
  payload?: { type: string; function?: string; type_arguments?: string[] }
  events?: { type: string; data: unknown }[]
}

export function microsToIso(micros: string): string {
  const ms = Math.floor(Number(micros) / 1000)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : ""
}

export interface AptosPackage {
  name: string
  /** Times the package has been upgraded since first publish (0 = never upgraded). */
  upgradeNumber: number
  /** 1 = compatible (upgradeable under compatibility rules), 2 = immutable. */
  upgradePolicy: number
  moduleNames: string[]
}

/**
 * Packages published under an account, from 0x1::code::PackageRegistry.
 * This is Aptos's equivalent of EVM upgrade history: each package carries an
 * upgrade counter and its declared upgrade policy, so "has this changed, and
 * can it change?" is answerable from one on-chain read.
 */
export async function getAptosPackages(address: string): Promise<AptosPackage[] | null> {
  const res = await aptosGet<{
    data?: {
      packages?: {
        name: string
        upgrade_number: string | number
        upgrade_policy?: { policy: string | number }
        modules?: { name: string }[]
      }[]
    }
  }>(`/accounts/${normalizeAptosAddress(address)}/resource/0x1::code::PackageRegistry`)

  const packages = res?.data?.packages
  if (!packages) return null
  return packages.map(p => ({
    name: p.name,
    upgradeNumber: Number(p.upgrade_number) || 0,
    upgradePolicy: Number(p.upgrade_policy?.policy) || 0,
    moduleNames: (p.modules ?? []).map(m => m.name),
  }))
}

export async function getAptosTransactionByHash(
  hashOrVersion: string,
  errmap?: AbortErrmap
): Promise<AptosTransaction | null> {
  const path = /^\d+$/.test(hashOrVersion)
    ? `/transactions/by_version/${hashOrVersion}`
    : `/transactions/by_hash/${hashOrVersion}`
  const raw = await aptosGet<RawUserTransaction>(path)
  if (!raw || raw.type !== "user_transaction") return null

  const payload = raw.payload
  const isEntryFunction = payload?.type === "entry_function_payload"
  return {
    hash: raw.hash,
    version: raw.version,
    success: raw.success,
    vmStatus: raw.vm_status,
    timestamp: microsToIso(raw.timestamp),
    sender: raw.sender,
    functionId: isEntryFunction ? (payload?.function ?? null) : null,
    typeArguments: (isEntryFunction ? payload?.type_arguments : undefined) ?? [],
    gasUsed: raw.gas_used,
    gasUnitPrice: raw.gas_unit_price,
    events: (raw.events ?? []).slice(0, 20).map(e => ({ type: e.type, data: e.data })),
    ...(raw.success === false ? { decodedAbort: decodeAbort(raw.vm_status, errmap) } : {}),
  }
}

export async function viewFunction(fn: string, typeArgs: string[], args: unknown[]): Promise<unknown[] | null> {
  const res = await aptosFetch(`${FULLNODE_BASE}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...aptosAuthHeaders() },
    body: JSON.stringify({ function: fn, type_arguments: typeArgs, arguments: args }),
  })
  if (!res || !res.ok) return null
  try {
    return (await res.json()) as unknown[]
  } catch {
    return null
  }
}

export interface AptosNetworkStatus {
  up: boolean
  latestVersion: string | null
  secondsBehind: number | null
}

export async function getAptosNetworkStatus(): Promise<AptosNetworkStatus> {
  const info = await getLedgerInfo()
  if (!info) return { up: false, latestVersion: null, secondsBehind: null }
  const behindMs = Date.now() - Math.floor(Number(info.ledgerTimestamp) / 1000)
  return {
    up: behindMs < 60_000,
    latestVersion: info.ledgerVersion,
    secondsBehind: Math.max(0, Math.round(behindMs / 1000)),
  }
}

export function formatUnits(raw: string, decimals: number): string {
  if (!/^\d+$/.test(raw) || decimals < 0) return raw
  const big = BigInt(raw)
  const base = 10n ** BigInt(decimals)
  const whole = big / base
  const frac = (big % base).toString().padStart(decimals, "0").replace(/0+$/, "")
  return frac ? `${whole}.${frac}` : whole.toString()
}

