import { NearLookupUnavailableError } from "./lookup"
import { nearRpc } from "./rpc"
import type { NearBalance, NearTokenBalance } from "./types"

/**
 * NEAR has 24 decimals, so a balance NEVER survives a JS number: 1 NEAR is
 * 1e24 yoctoNEAR and Number.MAX_SAFE_INTEGER is about 9e15. Every amount here
 * stays a string and every division is done on BigInt.
 */
const YOCTO_PER_NEAR = 10n ** 24n

/**
 * What NEAR charges an account for its own state, in yoctoNEAR per byte.
 * Read from the protocol config at runtime rather than hardcoded, because it is
 * a protocol parameter and not a constant of nature. Measured 2026-09-08 as
 * 1e19, i.e. 1 NEAR per 100kb.
 */
let storagePerByte: bigint | null = null

async function storageAmountPerByte(): Promise<bigint | null> {
  if (storagePerByte !== null) return storagePerByte
  const r = await nearRpc<{ runtime_config?: { storage_amount_per_byte?: string } }>(
    "EXPERIMENTAL_protocol_config", { finality: "final" })
  if (r.kind !== "ok") return null
  const v = r.value.runtime_config?.storage_amount_per_byte
  if (typeof v !== "string" || !/^\d+$/.test(v)) return null
  storagePerByte = BigInt(v)
  return storagePerByte
}

export function formatNear(yocto: bigint, dp = 6): string {
  const neg = yocto < 0n
  const abs = neg ? -yocto : yocto
  const whole = abs / YOCTO_PER_NEAR
  const frac = abs % YOCTO_PER_NEAR
  const fracStr = frac.toString().padStart(24, "0").slice(0, dp).replace(/0+$/, "")
  const body = fracStr ? `${whole}.${fracStr}` : whole.toString()
  return neg ? `-${body}` : body
}

interface ViewAccount { amount: string; locked: string; storage_usage: number }
interface FastNearFull {
  account_id?: string
  tokens?: Array<{ contract_id?: string; balance?: string }>
}

/**
 * A NEAR balance, and what of it can actually be sent.
 *
 * THE STORAGE TRAP, WHICH IS STELLAR'S RESERVE IN A DIFFERENT COSTUME: NEAR
 * charges an account for the state it keeps, so part of the balance cannot be
 * spent without deleting data. Someone looking at their wallet sees a number
 * they cannot send in full, and "why can't I send all of it" is a support
 * question on every chain that works this way.
 *
 * `spendableNear: null` means NOT COMPUTED, never zero and never "all of it".
 */
export async function getNearWalletBalance(accountId: string): Promise<NearBalance> {
  const acc = await nearRpc<ViewAccount>("query", {
    request_type: "view_account", finality: "final", account_id: accountId,
  })
  if (acc.kind === "unavailable") throw new NearLookupUnavailableError(acc.reason)
  if (acc.kind === "missing") {
    throw new NearLookupUnavailableError(`there is no NEAR account called ${accountId}`)
  }

  const yocto = BigInt(acc.value.amount || "0")
  const storageBytes = typeof acc.value.storage_usage === "number" ? acc.value.storage_usage : null
  const perByte = await storageAmountPerByte()
  const staked = perByte !== null && storageBytes !== null ? perByte * BigInt(storageBytes) : null
  const spendable = staked === null ? null : yocto - staked

  const { tokens, unavailable } = await tokenBalances(accountId)

  return {
    near: formatNear(yocto),
    yocto: yocto.toString(),
    // A negative spendable is real: an account can owe more storage than it
    // holds. Reporting it as zero would hide exactly the problem the user has.
    spendableNear: spendable === null ? null : formatNear(spendable),
    storageStakedYocto: staked === null ? null : staked.toString(),
    storageBytes,
    tokens,
    tokensUnavailable: unavailable,
  }
}

/**
 * Fungible-token holdings.
 *
 * NEAR HAS NO GLOBAL TOKEN INDEX. A balance lives inside each FT contract as
 * `ft_balance_of`, so listing what an account holds means already knowing which
 * contracts to ask. FastNEAR keeps that index and serves it keylessly, which is
 * the only reason this list can exist at all.
 *
 * When it cannot be read the list is EMPTY BECAUSE WE DID NOT LOOK, so the flag
 * says so and callers must not render it as "holds no tokens".
 */
async function tokenBalances(accountId: string): Promise<{ tokens: NearTokenBalance[]; unavailable: boolean }> {
  const base = process.env.NEAR_FASTNEAR_API ?? "https://api.fastnear.com"
  try {
    const res = await fetch(`${base}/v1/account/${encodeURIComponent(accountId)}/full`, {
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { tokens: [], unavailable: true }
    const body = (await res.json()) as FastNearFull
    if (!Array.isArray(body.tokens)) return { tokens: [], unavailable: true }
    const tokens = body.tokens
      .filter(t => typeof t.contract_id === "string" && typeof t.balance === "string")
      // A registered contract with a zero balance is noise, not a holding.
      .filter(t => { try { return BigInt(t.balance as string) > 0n } catch { return false } })
      .slice(0, 40)
      .map(t => ({ contractId: t.contract_id as string, amountRaw: t.balance as string }))
    return { tokens, unavailable: false }
  } catch {
    return { tokens: [], unavailable: true }
  }
}
