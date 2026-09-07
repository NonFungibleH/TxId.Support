import { inflateSync } from "node:zlib"
import { anchorIdlAddress } from "./pubkey"

/**
 * Read a program's IDL from the chain.
 *
 * WHY THIS EXISTS AND WHY IT MATTERS MORE THAN IT LOOKS. Both public Anchor IDL
 * registries are dead (anchor.projectserum.com and api.apr.dev, verified
 * 2026-09-07), and harvesting error names from live failures has a hard ceiling
 * of about 10%: it only finds programs that ALREADY print their errors, and
 * every one of the ten biggest sources of failure stays silent. Jupiter's 6001
 * alone was 624 occurrences in one sample and no amount of sampling reaches it.
 *
 * The IDL is the only remaining source, and Anchor writes it ON CHAIN, at
 * createWithSeed(pda([], program), "anchor:idl", program), zlib-compressed.
 *
 * Account layout:
 *   8 bytes   discriminator
 *   32 bytes  authority
 *   4 bytes   u32 LE length of the compressed payload
 *   N bytes   zlib-deflated IDL JSON
 */

export interface IdlError { code: number; name: string; msg?: string }

/**
 * Three outcomes, never two. `not_published` is a FINDING (this program has no
 * IDL account, which many legitimately do not); `unavailable` is not, and the
 * caller must be able to tell them apart before saying anything to a user.
 */
export type IdlLookup =
  | { kind: "ok"; idl: string; errors: IdlError[] }
  | { kind: "not_published" }
  | { kind: "unavailable"; reason: string }

const RPC = process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com"

async function getAccountData(address: string, timeoutMs: number): Promise<Uint8Array | null | "unavailable"> {
  let res: Response
  try {
    res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getAccountInfo", params: [address, { encoding: "base64" }] }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch { return "unavailable" }
  if (!res.ok) return "unavailable"
  let body: { result?: { value?: { data?: [string, string] } | null }; error?: unknown }
  try { body = (await res.json()) as typeof body } catch { return "unavailable" }
  // A JSON-RPC error is the node DECLINING to answer, not an answer.
  if (body.error) return "unavailable"
  const value = body.result?.value
  if (value === null || value === undefined) return null   // the account genuinely is not there
  const b64 = value.data?.[0]
  if (typeof b64 !== "string") return "unavailable"
  try { return new Uint8Array(Buffer.from(b64, "base64")) } catch { return "unavailable" }
}

/** Anchor stores errors as [{ code, name, msg }]. Both IDL spec versions agree here. */
function errorsFrom(idl: unknown): IdlError[] {
  const raw = (idl as { errors?: unknown })?.errors
  if (!Array.isArray(raw)) return []
  const out: IdlError[] = []
  for (const e of raw) {
    const code = (e as { code?: unknown })?.code
    const name = (e as { name?: unknown })?.name
    if (typeof code !== "number" || typeof name !== "string") continue
    const msg = (e as { msg?: unknown })?.msg
    out.push(typeof msg === "string" ? { code, name, msg } : { code, name })
  }
  return out
}

export async function fetchIdl(programAddress: string, timeoutMs = 9000): Promise<IdlLookup> {
  const address = anchorIdlAddress(programAddress.trim())
  if (!address) return { kind: "unavailable", reason: "not a valid Solana program address" }

  const data = await getAccountData(address, timeoutMs)
  if (data === "unavailable") return { kind: "unavailable", reason: "could not reach the Solana RPC" }
  // No account at the derived address means this program never published an
  // IDL. That is a real answer about the program, not a failure of ours.
  if (data === null) return { kind: "not_published" }
  if (data.length < 44) return { kind: "not_published" }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const len = view.getUint32(40, true)          // 8 discriminator + 32 authority
  if (len === 0 || 44 + len > data.length) return { kind: "unavailable", reason: "IDL account is truncated or malformed" }

  let json: string
  try {
    json = inflateSync(Buffer.from(data.buffer, data.byteOffset + 44, len)).toString("utf8")
  } catch {
    return { kind: "unavailable", reason: "IDL payload could not be decompressed" }
  }

  let parsed: unknown
  try { parsed = JSON.parse(json) } catch { return { kind: "unavailable", reason: "IDL is not valid JSON" } }

  return { kind: "ok", idl: json, errors: errorsFrom(parsed) }
}

/**
 * @deprecated Always returned null, and null here never meant "no IDL", it
 * meant "we could not ask". Use `fetchIdl`, which says which.
 */
export async function fetchIdlFromRegistry(programAddress: string): Promise<string | null> {
  const r = await fetchIdl(programAddress)
  return r.kind === "ok" ? r.idl : null
}
