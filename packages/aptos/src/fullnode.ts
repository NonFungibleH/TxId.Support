import type { AbortErrmap } from "./abort"
import { decodeAbort } from "./abort"
import { normalizeAptosAddress } from "./address"
import type { AptosModuleAbi, AptosModuleFunction, AptosTransaction, DecodedAbort } from "./types"

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
  payload?: { type: string; function?: string; type_arguments?: string[]; arguments?: unknown[] }
  events?: { type: string; data: unknown }[]
  changes?: { type?: string; address?: string }[]
  signature?: {
    type?: string
    fee_payer_address?: string
    secondary_signer_addresses?: string[]
  }
}

/** gasUsed x gasUnitPrice, both octas-denominated strings from the node. */
function feeFrom(gasUsed: string, gasUnitPrice: string): { octas: string; apt: string } {
  try {
    const octas = BigInt(gasUsed) * BigInt(gasUnitPrice)
    return { octas: octas.toString(), apt: formatUnits(octas.toString(), 8) }
  } catch {
    return { octas: "0", apt: "0" }
  }
}

export function microsToIso(micros: string): string {
  const ms = Math.floor(Number(micros) / 1000)
  return Number.isFinite(ms) ? new Date(ms).toISOString() : ""
}

/**
 * How long ago a timestamp was, computed HERE rather than by the model.
 *
 * WHY THIS EXISTS. The system prompt supplies the wall clock and asked the
 * model to do the subtraction. Asked "what was my last trade", it answered
 * with the correct fill and "about 9 minutes ago at 14:09:47 UTC" when the
 * current time was 15:19 UTC: the absolute stamp was right and the elapsed
 * time was an hour out, because comparing 14:09 to 15:19 by their minute
 * fields alone gives nine. The two halves of its own sentence disagreed, and
 * the session opener, which computes the same age in code, had it right on
 * screen at the same moment.
 *
 * This is the rule `feeApt` already follows one field above ("so the model
 * never does the maths itself"), applied to time. A derived figure we can
 * compute must never be left for the model to derive.
 *
 * Hours are spelled out alongside minutes ("1 hour 9 minutes ago") precisely
 * because a dropped hour is the observed failure: there is no phrasing here
 * that can lose one silently. A clock-skewed future stamp is labelled as such
 * rather than rendered as a negative age.
 */
export function relativeAge(iso: string, nowMs: number = Date.now()): string | null {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const diff = nowMs - t
  const future = diff < 0
  const mins = Math.floor(Math.abs(diff) / 60_000)
  const phrase = (() => {
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) {
      const rem = mins % 60
      const h = `${hrs} hour${hrs === 1 ? "" : "s"}`
      return rem === 0 ? h : `${h} ${rem} minute${rem === 1 ? "" : "s"}`
    }
    const days = Math.floor(hrs / 24)
    return `${days} day${days === 1 ? "" : "s"}`
  })()
  if (phrase === "just now") return "just now"
  return future ? `in ${phrase}` : `${phrase} ago`
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
    age: relativeAge(microsToIso(raw.timestamp)),
    sender: raw.sender,
    functionId: isEntryFunction ? (payload?.function ?? null) : null,
    typeArguments: (isEntryFunction ? payload?.type_arguments : undefined) ?? [],
    gasUsed: raw.gas_used,
    gasUnitPrice: raw.gas_unit_price,
    feeOctas: feeFrom(raw.gas_used, raw.gas_unit_price).octas,
    feeApt: feeFrom(raw.gas_used, raw.gas_unit_price).apt,
    signatureType: raw.signature?.type ?? null,
    feePayer: raw.signature?.fee_payer_address ?? null,
    secondarySigners: raw.signature?.secondary_signer_addresses ?? [],
    // Aptos charges separately for execution, IO and storage, and REFUNDS the
    // storage deposit when state is freed. "Why did this cost what it cost"
    // and "where is my storage refund" are only answerable from here.
    feeBreakdown: (() => {
      const fs = (raw.events ?? []).find(e => e.type.endsWith("::FeeStatement"))
      const d = fs?.data as Record<string, string> | undefined
      if (!d) return null
      return {
        executionGasUnits: d.execution_gas_units ?? null,
        ioGasUnits: d.io_gas_units ?? null,
        totalChargeGasUnits: d.total_charge_gas_units ?? null,
        storageFeeOctas: d.storage_fee_octas ?? null,
        storageRefundOctas: d.storage_fee_refund_octas ?? null,
      }
    })(),
    // FeeStatement is emitted LAST, so a naive head-slice would always drop the
    // very event that explains the gas cost and any storage refund. Keep it.
    events: (() => {
      const all = (raw.events ?? []).map(e => ({ type: e.type, data: e.data }))
      const feeStatements = all.filter(e => e.type.endsWith("::FeeStatement"))
      const rest = all.filter(e => !e.type.endsWith("::FeeStatement"))
      return [...rest.slice(0, 20), ...feeStatements]
    })(),
    functionArguments: (isEntryFunction ? payload?.arguments : undefined) ?? [],
    // Deduped: the same account is written several times in one transaction
    // (a store, its ObjectCore, its metadata) and a raw count reads as far more
    // activity than actually happened.
    stateWrites: (() => {
      const addresses = [
        ...new Set(
          (raw.changes ?? [])
            .map(c => c.address)
            .filter((a): a is string => typeof a === "string" && a.length > 0)
        ),
      ]
      return { count: (raw.changes ?? []).length, addresses }
    })(),
    ...(raw.success === false ? { decodedAbort: decodeAbort(raw.vm_status, errmap) } : {}),
  }
}

/**
 * The sender's ed25519 public key, recovered from a transaction they already
 * sent. Simulation validates the supplied public key against the account's
 * auth key, and we only ever hold an ADDRESS, so without this every simulate
 * call fails with INVALID_AUTH_KEY. An account that has never transacted has
 * no recoverable key, which is why simulation is best-effort.
 */
async function recoverPublicKey(address: string): Promise<string | null> {
  const addr = normalizeAptosAddress(address)
  // Primary: the account's own sequenced transactions. Returns [] for
  // stateless accounts (AIP-115) that have never incremented a sequence
  // number, hence the by-version fallback below.
  // Returns [] for a stateless account (AIP-115) that has never incremented a
  // sequence number. Those simply cannot be simulated, and the caller reports
  // that as a limit of the CHECK rather than a prediction of failure.
  const txs = await aptosGet<{ signature?: Record<string, unknown> }[]>(`/accounts/${addr}/transactions?limit=1`)
  const sig = txs?.[0]?.signature as Record<string, unknown> | undefined
  if (!sig) return null
  // fee_payer / multi_agent nest the sender's own signature under `sender`.
  const inner = (sig.sender as Record<string, unknown> | undefined) ?? sig
  const pk = inner.public_key
  if (typeof pk === "string") return pk
  const list = inner.public_keys
  return Array.isArray(list) && typeof list[0] === "string" ? list[0] : null
}

export interface AptosSimulation {
  /** Would this transaction succeed right now? */
  success: boolean
  vmStatus: string
  gasUsed: string | null
  gasUnitPrice: string
  /** Estimated fee in APT at the simulated gas price. */
  estimatedFeeApt: string | null
  /** Decoded reason when the simulation aborted, same decoder as a real tx. */
  decodedAbort?: DecodedAbort
}

/**
 * Pre-flight an entry function: "would this work if I tried it now?".
 *
 * Aptos simulation runs the real VM against current state without submitting,
 * so it answers retry questions definitively rather than by inference. Returns
 * null when we could not simulate at all (no recoverable public key, or the
 * node was unreachable), which the caller must not report as a failure of the
 * transaction itself.
 */
export async function simulateAptosEntryFunction(
  sender: string,
  functionId: string,
  typeArgs: string[],
  args: unknown[],
  errmap?: AbortErrmap,
): Promise<AptosSimulation | null> {
  const addr = normalizeAptosAddress(sender)
  const [publicKey, account, gas] = await Promise.all([
    recoverPublicKey(addr),
    aptosGet<{ sequence_number?: string }>(`/accounts/${addr}`),
    aptosGet<{ gas_estimate?: number }>("/estimate_gas_price"),
  ])
  if (!publicKey) return null

  const gasUnitPrice = String(gas?.gas_estimate ?? 100)
  const res = await aptosFetch(`${FULLNODE_BASE}/transactions/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...aptosAuthHeaders() },
    body: JSON.stringify({
      sender: addr,
      sequence_number: account?.sequence_number ?? "0",
      max_gas_amount: "100000",
      gas_unit_price: gasUnitPrice,
      expiration_timestamp_secs: String(Math.floor(Date.now() / 1000) + 600),
      payload: { type: "entry_function_payload", function: functionId, type_arguments: typeArgs, arguments: args },
      // Signature is not verified during simulation, but the public key must
      // match the account's auth key, hence the recovery above.
      signature: { type: "ed25519_signature", public_key: publicKey, signature: `0x${"0".repeat(128)}` },
    }),
  })
  if (!res || !res.ok) return null

  let body: unknown
  try { body = await res.json() } catch { return null }
  const sim = (Array.isArray(body) ? body[0] : body) as
    | { success?: boolean; vm_status?: string; gas_used?: string }
    | undefined
  if (!sim || typeof sim.success !== "boolean") return null

  const vmStatus = sim.vm_status ?? ""
  const fee = (() => {
    try { return formatUnits((BigInt(sim.gas_used ?? "0") * BigInt(gasUnitPrice)).toString(), 8) } catch { return null }
  })()
  return {
    success: sim.success,
    vmStatus,
    gasUsed: sim.gas_used ?? null,
    gasUnitPrice,
    estimatedFeeApt: fee,
    ...(sim.success === false ? { decodedAbort: decodeAbort(vmStatus, errmap) } : {}),
  }
}

export type ViewResult =
  | { ok: true; data: unknown[] }
  /** The VM ran and rejected the call, e.g. the resource does not exist yet. */
  | { ok: false; kind: "aborted"; message: string }
  /** We never got an answer: network/timeout/rate limit. */
  | { ok: false; kind: "unreachable" }

/**
 * Like viewFunction, but keeps "the chain answered no" separate from "we could
 * not reach the chain". A Move view aborts (HTTP 400) when the resource it
 * reads does not exist: for a perps subaccount that has never opened a
 * position, "Failed to borrow global resource" is a real ANSWER (no positions),
 * not a lookup failure. Collapsing both into null makes the bot either invent
 * an outage or invent an empty portfolio.
 */
export async function viewFunctionResult(fn: string, typeArgs: string[], args: unknown[]): Promise<ViewResult> {
  const res = await aptosFetch(`${FULLNODE_BASE}/view`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...aptosAuthHeaders() },
    body: JSON.stringify({ function: fn, type_arguments: typeArgs, arguments: args }),
  })
  if (!res) return { ok: false, kind: "unreachable" }
  if (!res.ok) {
    // 4xx = the VM/API rejected this specific call; 5xx = the node is unwell.
    //
    // EXCEPT the throttling and timeout codes. Those say nothing about the
    // call, and callers read "aborted" as a statement of fact about the
    // account: resolveProtocolAccountAddress turns it into "this wallet has no
    // subaccount", which would tell an active trader they have never traded
    // here simply because we were rate limited.
    if (res.status >= 500 || res.status === 429 || res.status === 408 || res.status === 425) {
      return { ok: false, kind: "unreachable" }
    }
    let message = `view call rejected (HTTP ${res.status})`
    try {
      const body = (await res.json()) as { message?: string }
      if (body?.message) message = body.message
    } catch { /* keep the generic message */ }
    return { ok: false, kind: "aborted", message }
  }
  try {
    return { ok: true, data: (await res.json()) as unknown[] }
  } catch {
    return { ok: false, kind: "unreachable" }
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
  /**
   * Gas unit price in octas from /estimate_gas_price. The EVM side returns a
   * suggested max fee, so without this the bot could not answer "what gas
   * price should I set" on Aptos at all. `prioritized` is what to use when a
   * transaction keeps failing to land.
   */
  gasUnitPrice: number | null
  gasUnitPricePrioritized: number | null
  gasUnitPriceDeprioritized: number | null
}

export async function getAptosNetworkStatus(): Promise<AptosNetworkStatus> {
  const [info, gas] = await Promise.all([
    getLedgerInfo(),
    aptosGet<{
      gas_estimate?: number
      prioritized_gas_estimate?: number
      deprioritized_gas_estimate?: number
    }>("/estimate_gas_price"),
  ])
  const gasFields = {
    gasUnitPrice: gas?.gas_estimate ?? null,
    gasUnitPricePrioritized: gas?.prioritized_gas_estimate ?? null,
    gasUnitPriceDeprioritized: gas?.deprioritized_gas_estimate ?? null,
  }
  if (!info) return { up: false, latestVersion: null, secondsBehind: null, ...gasFields }
  const behindMs = Date.now() - Math.floor(Number(info.ledgerTimestamp) / 1000)
  return {
    up: behindMs < 60_000,
    latestVersion: info.ledgerVersion,
    secondsBehind: Math.max(0, Math.round(behindMs / 1000)),
    ...gasFields,
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

