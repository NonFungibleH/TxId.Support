import type { AbortErrmap } from "./abort"
import { decodeAbort } from "./abort"
import { normalizeAptosAddress } from "./address"
import type { AptosModuleAbi, AptosModuleFunction, AptosTransaction } from "./types"

const FULLNODE_BASE = "https://fullnode.mainnet.aptoslabs.com/v1"

export function aptosAuthHeaders(): Record<string, string> {
  return process.env.APTOS_API_KEY ? { Authorization: `Bearer ${process.env.APTOS_API_KEY}` } : {}
}

export async function aptosGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${FULLNODE_BASE}${path}`, {
      headers: { ...aptosAuthHeaders() },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
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
  const raws = await aptosGet<RawModule[]>(`/accounts/${addr}/modules?limit=25`)
  if (!raws) return null
  return raws.map(mapModule).filter((m): m is AptosModuleAbi => m !== null)
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

function microsToIso(micros: string): string {
  return new Date(Math.floor(Number(micros) / 1000)).toISOString()
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
  try {
    const res = await fetch(`${FULLNODE_BASE}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...aptosAuthHeaders() },
      body: JSON.stringify({ function: fn, type_arguments: typeArgs, arguments: args }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
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
  const big = BigInt(raw)
  const base = 10n ** BigInt(decimals)
  const whole = big / base
  const frac = (big % base).toString().padStart(decimals, "0").replace(/0+$/, "")
  return frac ? `${whole}.${frac}` : whole.toString()
}

export interface AptosWalletDiagnosis {
  exists: boolean
  sequenceNumber: string | null
  aptBalance: string | null
  recentFailureCount: number
}

export async function diagnoseAptosWallet(address: string): Promise<AptosWalletDiagnosis> {
  const addr = normalizeAptosAddress(address)
  const [account, balanceResult] = await Promise.all([
    getAccount(addr),
    viewFunction("0x1::coin::balance", ["0x1::aptos_coin::AptosCoin"], [addr]),
  ])
  const octas = balanceResult?.[0]
  return {
    exists: account !== null,
    sequenceNumber: account?.sequenceNumber ?? null,
    aptBalance: typeof octas === "string" ? formatUnits(octas, 8) : null,
    recentFailureCount: 0,
  }
}
