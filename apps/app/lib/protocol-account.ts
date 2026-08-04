import { adapterFor, resolveProtocolAccountAddress } from "@txid/aptos"
import type { ProjectConfig } from "@/lib/types/config"

/**
 * The user's protocol account (subaccount), resolved once and shared.
 *
 * WHY THIS IS ONE MODULE: two callers need the same answer within seconds of
 * each other. The widget asks on connect so it can show the address in the
 * header, and the chat route asks on the next message so the model knows the
 * user has two identities before it is asked about them. Resolving twice is a
 * wasted view call against a fullnode we have already rate limited ourselves
 * against twice during development.
 *
 * `failed` is NOT `none`. A throttled lookup that renders as "you have no
 * account" tells an active trader they have never traded, which is the exact
 * bug this codebase has already shipped once. Callers must branch on all four.
 *
 * ONE ACCOUNT PER WALLET, deliberately. `adapter.resolveAccountFn` returns a
 * single account (Decibel's `primary_subaccount`), and the widget names it as
 * "your sub account". If a protocol ever lets one wallet hold several, that
 * phrasing becomes a confident lie and this needs to return a list before the
 * UI can be trusted. Decided 2026-08-04: single for now.
 */

export type ProtocolAccountStatus =
  /** The protocol has per-user accounts and this wallet has one. */
  | { status: "ok"; protocol: string; label: string; address: string }
  /** The protocol has them, this wallet has not created one (never deposited). */
  | { status: "none"; protocol: string; label: string }
  /** We could not find out. Never render this as "none". */
  | { status: "failed"; protocol: string; label: string }
  /** Not enabled, or this protocol has no such concept. Show nothing. */
  | { status: "off" }

const OFF: ProtocolAccountStatus = { status: "off" }

/** Resolution is deterministic on chain, so a short TTL is safe and cheap. */
const TTL_MS = 5 * 60_000
const cache = new Map<string, { at: number; value: ProtocolAccountStatus }>()

/** Bounded so a busy instance cannot grow the map without limit. */
function remember(key: string, value: ProtocolAccountStatus): ProtocolAccountStatus {
  // A failure is worth retrying sooner than a success, so it is not cached.
  if (value.status === "failed") return value
  if (cache.size > 500) cache.clear()
  cache.set(key, { at: Date.now(), value })
  return value
}

export function subaccountsEnabled(config: ProjectConfig): boolean {
  return config.subaccounts?.enabled === true
}

/**
 * Resolve a wallet to its protocol account. Returns `off` unless the project
 * has opted in AND one of its watched contracts matches a known adapter, so a
 * protocol without subaccounts never gains a second address.
 */
export async function resolveProtocolAccount(
  config: ProjectConfig,
  walletAddress: string | null | undefined,
): Promise<ProtocolAccountStatus> {
  if (!walletAddress || !subaccountsEnabled(config)) return OFF

  const adapter = adapterFor(
    (config.watchedContracts ?? []).map(c => ({ address: c.address, chain: c.chain as string })),
  )
  if (!adapter) return OFF

  const key = `${adapter.name}:${walletAddress.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value

  const meta = { protocol: adapter.name, label: adapter.accountLabel }

  const resolved = await resolveProtocolAccountAddress(adapter, walletAddress).catch(
    () => ({ status: "failed" as const }),
  )
  if (resolved.status === "ok") {
    return remember(key, { status: "ok", ...meta, address: resolved.address })
  }
  if (resolved.status === "none") return remember(key, { status: "none", ...meta })
  return remember(key, { status: "failed", ...meta })
}
