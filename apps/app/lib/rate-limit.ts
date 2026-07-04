// Shared rate limiter. Uses Upstash Redis (via its REST API — no SDK
// dependency) when configured, so limits are enforced across every
// serverless instance. Falls back to a per-instance in-memory counter
// when the Upstash env vars are absent, so local dev and un-configured
// deploys still get basic abuse protection (just not distributed).
//
// Env:
//   UPSTASH_REDIS_REST_URL   — e.g. https://xxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN — REST token from the Upstash console
//
// Both must be set for the distributed path; if either is missing we
// silently use the in-memory fallback.

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const UPSTASH_ENABLED = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

export interface RateLimitResult {
  allowed: boolean
  /** Requests left in the current window (best-effort; 0 when blocked). */
  remaining: number
}

// ── In-memory fallback ───────────────────────────────────────────────────────
interface MemEntry { count: number; resetAt: number }
const memMap = new Map<string, MemEntry>()

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memMap.get(key)
  if (!entry || now >= entry.resetAt) {
    memMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1 }
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0 }
  entry.count++
  return { allowed: true, remaining: limit - entry.count }
}

// ── Upstash fixed-window ─────────────────────────────────────────────────────
// One pipelined round-trip: INCR the counter, then set its TTL only if it
// doesn't already have one (EXPIRE ... NX). That makes each key live for
// exactly one window from its first hit, giving a clean fixed window.
async function upstashLimit(key: string, limit: number, windowSec: number): Promise<RateLimitResult> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
    ]),
    // Upstash is fast; don't let a slow edge hang the request path.
    signal: AbortSignal.timeout(2000),
  })
  if (!res.ok) throw new Error(`Upstash ${res.status}`)
  const data = (await res.json()) as Array<{ result?: number; error?: string }>
  const count = data[0]?.result ?? 0
  const remaining = Math.max(0, limit - count)
  return { allowed: count <= limit, remaining }
}

/**
 * Check and consume one token for `key`.
 *
 * @param key      Unique bucket key (e.g. `chat:${ip}`).
 * @param limit    Max requests allowed per window.
 * @param windowMs Window length in milliseconds.
 *
 * Fails open to the in-memory limiter on any Upstash error, so a Redis
 * blip degrades protection rather than blocking legitimate traffic.
 */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  if (UPSTASH_ENABLED) {
    try {
      return await upstashLimit(key, limit, Math.ceil(windowMs / 1000))
    } catch {
      // Redis unreachable — fall back to the in-memory limiter so we
      // still cap abuse on this instance instead of failing fully open.
      return memoryLimit(key, limit, windowMs)
    }
  }
  return memoryLimit(key, limit, windowMs)
}
