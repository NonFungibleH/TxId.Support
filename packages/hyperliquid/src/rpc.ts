/**
 * HyperCore, which is the part of Hyperliquid that is not a chain.
 *
 * Hyperliquid is TWO systems sharing one address space. HyperEVM (chain 999) is
 * an ordinary EVM chain and belongs in CHAIN_CONFIGS. HyperCore is the
 * perpetuals and spot exchange, and it is where the actual product lives: it
 * has its own state, its own order lifecycle, and its own vocabulary for why
 * something did not happen. None of that is reachable through an EVM RPC.
 *
 * One endpoint, keyless, no account required. Override with HYPERLIQUID_API.
 */
const DEFAULT_API = "https://api.hyperliquid.xyz/info"

function endpoint(): string {
  const raw = process.env.HYPERLIQUID_API?.trim()
  if (!raw) return DEFAULT_API
  if (!/^https?:\/\//i.test(raw)) {
    // A set-but-useless value is the dangerous case: someone believes they have
    // moved off the public endpoint when they have not. Say so.
    console.warn("[hyperliquid] HYPERLIQUID_API is not a usable http(s) URL. Using the public endpoint.")
    return DEFAULT_API
  }
  return raw
}

export type InfoOutcome =
  | { ok: true; result: unknown }
  | { ok: false; reason: string }

export async function info(body: Record<string, unknown>, timeoutMs = 15_000): Promise<InfoOutcome> {
  const url = endpoint()
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!res.ok) return { ok: false, reason: `Hyperliquid returned ${res.status}` }
    return { ok: true, result: await res.json() }
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "network error" }
  }
}
