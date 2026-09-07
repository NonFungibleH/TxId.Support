import { normalizeSuiAddress } from "./abort"
import { rpc } from "./rpc"

/**
 * From the address that executed to the address the package was first published
 * at, because on Sui those are not the same thing and the difference silently
 * breaks every error map.
 *
 * A Sui upgrade publishes the package again at a NEW address. Both versions
 * stay live, apps migrate at their own pace, and an abort reports whichever
 * runtime address ran. Measured on mainnet 2026-09-07: inside a single
 * 150-checkpoint window, DeepBook aborts arrived under THREE different
 * addresses (0x0e735f8c, 0xb29d83c2, 0xcaf6ba05). A map keyed on any one of
 * them explains a third of them and, after the next upgrade, none.
 *
 * The module's own `address` in sui_getNormalizedMoveModule is the ORIGINAL
 * published id and does not move across upgrades. Verified: all three of those
 * runtime addresses report 0x2c8d603b… for `balance_manager`.
 *
 * TRI-STATE, and it matters here more than usual. `unavailable` must not
 * collapse into `unknown`, because "we could not ask which package this is" and
 * "this package publishes no description for that code" read identically to a
 * user and have opposite fixes.
 */
export type PackageOrigin =
  | { kind: "ok"; original: string }
  | { kind: "unknown" }
  | { kind: "unavailable"; reason: string }

/**
 * Package ids are immutable, so this never needs invalidating within a process.
 * Bounded anyway: an unbounded map fed by user-supplied digests is a slow leak.
 */
const CACHE_MAX = 500
const cache = new Map<string, string>()

function remember(key: string, original: string): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, original)
}

export async function resolveOriginalPackage(runtimePackage: string, module: string): Promise<PackageOrigin> {
  const pkg = normalizeSuiAddress(runtimePackage)
  if (!/^0x[0-9a-f]{64}$/.test(pkg) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(module)) {
    return { kind: "unknown" }
  }
  const key = `${pkg}::${module}`
  const hit = cache.get(key)
  if (hit) return { kind: "ok", original: hit }

  const out = await rpc("sui_getNormalizedMoveModule", [pkg, module])
  if (!out.ok) {
    // A node that has never heard of the package is answering; a node that
    // could not be reached is not. We only get the message to tell them apart.
    if (/not\s*found|does not exist|no module|cannot find/i.test(out.reason)) return { kind: "unknown" }
    return { kind: "unavailable", reason: out.reason }
  }
  const address = (out.result as { address?: unknown } | null)?.address
  if (typeof address !== "string") return { kind: "unknown" }

  const original = normalizeSuiAddress(address)
  if (!/^0x[0-9a-f]{64}$/.test(original)) return { kind: "unknown" }
  remember(key, original)
  return { kind: "ok", original }
}

/** Test seam. Package ids are immutable, so nothing else has cause to call this. */
export function __clearPackageOriginCache(): void {
  cache.clear()
}
