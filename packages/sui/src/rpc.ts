/**
 * Reading Sui, which is harder than it should be.
 *
 * SUI'S OWN PUBLIC FULLNODE NO LONGER SERVES JSON-RPC. Every method returns
 * "JSON-RPC on public fullnodes has been deprecated" (verified 2026-09-07,
 * every method tried, not just one, and re-verified while building the error
 * maps). Mysten points at gRPC and GraphQL through commercial providers. Two
 * third-party endpoints still serve the JSON-RPC keyless, one of them
 * PublicNode, which our Ethereum and Polygon defaults already use.
 *
 * So this rides on somebody else's infrastructure by necessity, not by choice.
 * That is exactly the arrangement that rotted on Ethereum (cloudflare-eth
 * decommissioned) and Polygon ("tenant disabled"), so: more than one endpoint,
 * tried in order, and SUI_RPC_URLS overrides the list without a deploy.
 */
const DEFAULT_ENDPOINTS = [
  "https://sui-rpc.publicnode.com",
  "https://rpc-mainnet.suiscan.xyz",
]

export function endpoints(): string[] {
  const raw = process.env.SUI_RPC_URLS
  if (!raw) return DEFAULT_ENDPOINTS
  const list = raw.split(",").map(s => s.trim()).filter(s => /^https?:\/\//i.test(s))
  // A set-but-useless value is the dangerous case: someone believes they have
  // moved off the public endpoints when they have not. Say so.
  if (list.length === 0) {
    console.warn("[sui] SUI_RPC_URLS is set but contains no usable http(s) endpoints. Using the public ones.")
    return DEFAULT_ENDPOINTS
  }
  return list
}

export type RpcOutcome = { ok: true; result: unknown } | { ok: false; reason: string }

/**
 * One call, across the endpoint list. A JSON-RPC `error` object is a node
 * DECLINING to answer, not an answer, so it does not stop the fallback.
 */
export async function rpc(method: string, params: unknown[], timeoutMs = 12_000): Promise<RpcOutcome> {
  let lastReason = "no endpoint answered"
  for (const url of endpoints()) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) { lastReason = `${new URL(url).host} returned ${res.status}`; continue }
      const body = (await res.json()) as { result?: unknown; error?: { message?: string } }
      if (body.error) { lastReason = body.error.message ?? "the node declined the request"; continue }
      if (body.result === undefined) { lastReason = `${new URL(url).host} returned no result`; continue }
      return { ok: true, result: body.result }
    } catch (e) {
      lastReason = e instanceof Error ? e.message : "network error"
    }
  }
  return { ok: false, reason: lastReason }
}
