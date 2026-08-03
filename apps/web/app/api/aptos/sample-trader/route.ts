import { NextResponse } from "next/server"

// A wallet with a live Decibel book, for the demo's "use a live trader"
// escape hatch.
//
// WHY: primary_subaccount resolves for ANY wallet, so someone who connects a
// wallet that has never traded on Decibel gets a correct but empty answer, and
// the demo lands flat. Reviewers are exactly the people least likely to hold a
// perps position. This finds a wallet that currently holds one, so the demo
// always has something real to talk about.
//
// The address is public on-chain data, the same any block explorer shows. No
// identity is attached, and nothing is written.

const DECIBEL = "0x50ead22afd6ffd9769e3b3d6e0e64a2a350d68e8b102c4e72e33d0b8cfdfdb06"
const INDEXER = "https://api.mainnet.aptoslabs.com/v1/graphql"
const FULLNODE = "https://fullnode.mainnet.aptoslabs.com/v1"

export const runtime = "nodejs"
export const maxDuration = 30

// Books change slowly and the reads are rate limited, so hold the answer for a
// few minutes rather than re-deriving it per visitor.
let cached: { at: number; address: string } | null = null
const TTL_MS = 5 * 60_000

function authHeaders(): Record<string, string> {
  const key = process.env.APTOS_API_KEY
  return key ? { Authorization: `Bearer ${key}` } : {}
}

async function view(fn: string, args: unknown[]): Promise<unknown[] | null> {
  try {
    const r = await fetch(`${FULLNODE}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ function: fn, type_arguments: [], arguments: args }),
      cache: "no-store",
    })
    return r.ok ? ((await r.json()) as unknown[]) : null
  } catch {
    return null
  }
}

export async function GET() {
  if (cached && Date.now() - cached.at < TTL_MS) {
    return NextResponse.json({ address: cached.address, cached: true })
  }

  try {
    const res = await fetch(INDEXER, {
      method: "POST",
      headers: { "content-type": "application/json", ...authHeaders() },
      cache: "no-store",
      body: JSON.stringify({
        query: `query { user_transactions(
          where: { entry_function_id_str: { _like: "${DECIBEL}::dex_accounts_entry::%" } }
          order_by: { version: desc }, limit: 60
        ) { sender } }`,
      }),
    })
    if (!res.ok) return NextResponse.json({ error: "indexer unavailable" }, { status: 503 })
    const body = (await res.json()) as { data?: { user_transactions?: { sender: string }[] } }
    const senders = Array.from(new Set((body.data?.user_transactions ?? []).map(t => t.sender)))

    // Walk recent traders until one has an open position. Bounded so a quiet
    // period cannot turn this into a long scan.
    for (const sender of senders.slice(0, 8)) {
      const sub = await view(`${DECIBEL}::dex_accounts::primary_subaccount`, [sender])
      const raw = Array.isArray(sub) ? sub[0] : null
      const account =
        typeof raw === "string" ? raw
        : raw && typeof raw === "object" && "inner" in raw ? String((raw as { inner: unknown }).inner)
        : null
      if (!account) continue

      const positions = await view(`${DECIBEL}::perp_engine::list_positions`, [account])
      const list = Array.isArray(positions) ? positions[0] : null
      if (Array.isArray(list) && list.length > 0) {
        cached = { at: Date.now(), address: sender }
        return NextResponse.json({ address: sender, positions: list.length })
      }
    }
    return NextResponse.json({ error: "no active trader found right now" }, { status: 404 })
  } catch {
    return NextResponse.json({ error: "lookup failed" }, { status: 503 })
  }
}
