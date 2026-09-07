import type { LayerZeroMessage, LzLookup, LzLeg } from "./types"

const BASE = process.env.LAYERZERO_SCAN_API ?? "https://scan.layerzero-api.com/v1"

/** Shape of the upstream response, only the fields we read. */
interface RawMessage {
  guid?: string
  pathway?: {
    sender?: { address?: string; name?: string; chain?: string }
    receiver?: { address?: string; chain?: string }
  }
  source?: { status?: string; tx?: { txHash?: string; blockTimestamp?: number } }
  destination?: { status?: string; tx?: { txHash?: string; blockTimestamp?: number } }
}

const leg = (raw: RawMessage["source"], chain: string | null): LzLeg => ({
  chain,
  status: raw?.status ?? "UNKNOWN",
  // Upstream reports an all-zeroes hash for a leg that has not landed. That is
  // not a transaction, and returning it as one would put a dead link in front
  // of a user looking for money that has not arrived.
  txHash: raw?.tx?.txHash && !/^0x0+$/.test(raw.tx.txHash) ? raw.tx.txHash : null,
  blockTimestamp: typeof raw?.tx?.blockTimestamp === "number" ? raw.tx.blockTimestamp : null,
})

function normalise(raw: RawMessage): LayerZeroMessage {
  const p = raw.pathway ?? {}
  const appName = p.sender?.name
  return {
    guid: raw.guid ?? null,
    // The API writes "unknown" as a NAME for apps it cannot identify. Carrying
    // that through would render as 'sent via "unknown"', which reads like a
    // finding about the app rather than an absence of one.
    app: appName && appName.toLowerCase() !== "unknown" ? appName : null,
    sender: p.sender?.address ?? null,
    receiver: p.receiver?.address ?? null,
    source: leg(raw.source, p.sender?.chain ?? null),
    destination: leg(raw.destination, p.receiver?.chain ?? null),
  }
}

/**
 * Look up every LayerZero message carried by a source transaction.
 *
 * A transaction can carry several (a batched send emits one per destination),
 * hence a list. `not_found` is the upstream's own 404, which it returns
 * cleanly, verified against a well-formed hash that does not exist:
 *   {"message":"Message not found for tx 0xdead…!","code":4040}
 */
export async function getLayerZeroMessages(txHash: string, timeoutMs = 9000): Promise<LzLookup> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash.trim())) {
    return { kind: "unavailable", reason: "not a transaction hash" }
  }
  let res: Response
  try {
    res = await fetch(`${BASE}/messages/tx/${txHash.trim()}`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (e) {
    return { kind: "unavailable", reason: e instanceof Error ? e.message : "network error" }
  }
  if (res.status === 404) return { kind: "not_found" }
  if (!res.ok) return { kind: "unavailable", reason: `LayerZero Scan returned ${res.status}` }
  let body: { data?: RawMessage[] }
  try {
    body = (await res.json()) as { data?: RawMessage[] }
  } catch {
    return { kind: "unavailable", reason: "LayerZero Scan returned unreadable JSON" }
  }
  const data = Array.isArray(body.data) ? body.data : []
  // A 200 carrying no messages is the same fact as a 404, and the upstream is
  // not consistent about which it sends. Treat them identically rather than
  // reporting an empty list, which a caller would render as "nothing moved".
  if (data.length === 0) return { kind: "not_found" }
  return { kind: "ok", messages: data.map(normalise) }
}
