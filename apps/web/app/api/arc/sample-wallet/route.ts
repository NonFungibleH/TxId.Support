import { NextResponse } from "next/server"

// A real Arc wallet whose most recent transaction FAILED, for the demo's
// "use a live Arc wallet" button.
//
// WHY: the product is what happens after a transaction fails, and someone
// trying the demo usually has a clean wallet, or no Arc wallet at all. This
// walks back from the newest block and returns a wallet that just had a
// transaction fail, so the first question ("why did my last transaction
// fail?") has a real answer from the chain.
//
// Bots are skipped. About 80% of Arc transactions come from wallets with tens
// of thousands of sends (measured 2026-11-25), and a demo built on an
// arbitrage bot's revert would show the wrong product. A wallet qualifies
// only if it has sent fewer than BOT_NONCE transactions and the failure is its
// latest one, so the answer the visitor gets is about what that wallet did last.
//
// Public on-chain data, the same any explorer shows. No identity is attached,
// and nothing is written.

const RPC = "https://rpc.mainnet.arc.io"
const BOT_NONCE = 5000
const WINDOWS = 24
const BLOCKS_PER_WINDOW = 20
const BLOCKS_PER_STEP = 1200 // ~10 minutes at Arc's ~0.5s blocks

export const runtime = "nodejs"
export const maxDuration = 30

let cached: { at: number; address: string; hash: string; failed: boolean } | null = null
const TTL_MS = 3 * 60_000

type Rpc = { id: number; result?: unknown; error?: unknown }

async function batch(calls: { method: string; params: unknown[] }[]): Promise<unknown[] | null> {
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, method: c.method, params: c.params }))),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) return null
    const body = (await r.json()) as Rpc[]
    if (!Array.isArray(body)) return null
    const out = new Array<unknown>(calls.length)
    for (const x of body) out[x.id] = x.error === undefined ? x.result : null
    return out
  } catch {
    return null
  }
}

interface Tx { hash: string; from: string; nonce: string }

export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ address: cached.address, hash: cached.hash, failed: cached.failed, cached: true })
  }
  const head = await batch([{ method: "eth_blockNumber", params: [] }])
  const latest = head?.[0] ? Number(BigInt(head[0] as string)) : NaN
  if (!Number.isFinite(latest)) return NextResponse.json({ error: "Arc did not answer just now. Paste an address instead." }, { status: 503 })

  // If no everyday wallet failed in the last few hours, a recent everyday
  // wallet is still a better demo than a dead end. The response says which.
  let fallback: { address: string; hash: string } | null = null
  for (let w = 0; w < WINDOWS; w++) {
    const start = latest - 2 - w * BLOCKS_PER_STEP
    const blocks = await batch(Array.from({ length: BLOCKS_PER_WINDOW }, (_, i) => ({ method: "eth_getBlockByNumber", params: ["0x" + (start - i).toString(16), true] })))
    if (!blocks) continue
    const candidates = (blocks as ({ transactions?: Tx[] } | null)[])
      .flatMap(b => b?.transactions ?? [])
      .filter(t => Number(BigInt(t.nonce)) < BOT_NONCE)
    if (candidates.length === 0) continue
    if (!fallback) fallback = { address: candidates[0]!.from, hash: candidates[0]!.hash }
    // Receipts in batches of eight: Arc's public node refuses larger archive batches.
    for (let i = 0; i < candidates.length; i += 8) {
      const chunk = candidates.slice(i, i + 8)
      const receipts = await batch(chunk.map(t => ({ method: "eth_getTransactionReceipt", params: [t.hash] })))
      if (!receipts) continue
      for (let j = 0; j < chunk.length; j++) {
        const rc = receipts[j] as { status?: string } | null
        if (rc?.status !== "0x0") continue
        const t = chunk[j]!
        // Only if this failure is the wallet's LATEST transaction: the visitor
        // will ask about "my last transaction", and the answer must be this one.
        const now = await batch([{ method: "eth_getTransactionCount", params: [t.from, "latest"] }])
        const sent = now?.[0] ? Number(BigInt(now[0] as string)) : NaN
        if (sent !== Number(BigInt(t.nonce)) + 1) continue
        cached = { at: Date.now(), address: t.from, hash: t.hash, failed: true }
        return NextResponse.json({ address: t.from, hash: t.hash, failed: true })
      }
    }
  }
  if (fallback) {
    cached = { at: Date.now(), ...fallback, failed: false }
    return NextResponse.json({ ...fallback, failed: false })
  }
  return NextResponse.json({ error: "Arc did not answer just now. Paste an address instead." }, { status: 503 })
}
