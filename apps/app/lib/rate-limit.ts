// Shared rate limiter. Uses Upstash Redis (via its REST API - no SDK
// dependency) when configured, so limits are enforced across every
// serverless instance. Falls back to a per-instance in-memory counter
// when the Upstash env vars are absent, so local dev and un-configured
// deploys still get basic abuse protection (just not distributed).
//
// Env:
//   UPSTASH_REDIS_REST_URL   - e.g. https://xxx.upstash.io
//   UPSTASH_REDIS_REST_TOKEN - REST token from the Upstash console
//
// Both must be set for the distributed path. When they are not, or when an
// Upstash call fails or times out, the fallback counter is per lambda: on
// Vercel each concurrent instance keeps its own Map, so N instances allow
// N x the intended rate. That degradation used to be silent. It is now logged
// (event "rate_limit.degraded"), reported to callers via `degraded`, and
// callers can pass a tighter `degradedLimit` for the fallback path.

import { log } from "@/lib/logger"

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
const UPSTASH_ENABLED = Boolean(UPSTASH_URL && UPSTASH_TOKEN)

export interface RateLimitResult {
  allowed: boolean
  /** Requests left in the current window (best-effort; 0 when blocked). */
  remaining: number
  /**
   * True when the count came from the per-instance fallback, i.e. the
   * distributed limiter was unavailable. Callers can use this to respond more
   * conservatively instead of assuming the limit was enforced globally.
   */
  degraded: boolean
}

export interface RateLimitOptions {
  /**
   * Limit applied INSTEAD of `limit` on the fallback path. Should be a
   * fraction of `limit`, since the fallback is enforced once per concurrent
   * instance rather than once globally.
   */
  degradedLimit?: number
}

// ── Degradation logging ──────────────────────────────────────────────────────
// Throttled: an outage would otherwise emit one line per request. One line a
// minute per reason is enough to alert on and cheap to keep.
const DEGRADED_LOG_INTERVAL_MS = 60_000
let lastUnconfiguredLogAt = 0
let lastErrorLogAt = 0

function logUnconfigured(): void {
  const now = Date.now()
  if (now - lastUnconfiguredLogAt < DEGRADED_LOG_INTERVAL_MS) return
  lastUnconfiguredLogAt = now
  log.warn("Distributed rate limiter not configured, per-instance fallback in use", {
    event: "rate_limit.degraded",
    reason: "unconfigured",
  })
}

function logUpstashFailure(err: unknown, key: string): void {
  const now = Date.now()
  if (now - lastErrorLogAt < DEGRADED_LOG_INTERVAL_MS) return
  lastErrorLogAt = now
  log.error("Distributed rate limiter unavailable, per-instance fallback in use", err, {
    event: "rate_limit.degraded",
    reason: "error",
    // Bucket prefix only: the full key embeds an IP or a publishable key.
    bucket: key.split(":")[0],
  })
}

// ── In-memory fallback ───────────────────────────────────────────────────────
interface MemEntry { count: number; resetAt: number }
const memMap = new Map<string, MemEntry>()

function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()
  const entry = memMap.get(key)
  if (!entry || now >= entry.resetAt) {
    memMap.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, degraded: true }
  }
  if (entry.count >= limit) return { allowed: false, remaining: 0, degraded: true }
  entry.count++
  return { allowed: true, remaining: limit - entry.count, degraded: true }
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
  return { allowed: count <= limit, remaining, degraded: false }
}

/**
 * Check and consume one token for `key`.
 *
 * @param key      Unique bucket key (e.g. `chat:${ip}`).
 * @param limit    Max requests allowed per window.
 * @param windowMs Window length in milliseconds.
 * @param options  `degradedLimit` applies on the fallback path only.
 *
 * Falls back to the in-memory limiter on any Upstash error, so a Redis blip
 * degrades protection rather than blocking legitimate traffic. The result's
 * `degraded` flag says whether that happened.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  options?: RateLimitOptions,
): Promise<RateLimitResult> {
  const fallbackLimit = options?.degradedLimit ?? limit
  if (UPSTASH_ENABLED) {
    try {
      return await upstashLimit(key, limit, Math.ceil(windowMs / 1000))
    } catch (err) {
      // Redis unreachable - fall back to the in-memory limiter so we
      // still cap abuse on this instance instead of failing fully open.
      logUpstashFailure(err, key)
      return memoryLimit(key, fallbackLimit, windowMs)
    }
  }
  logUnconfigured()
  return memoryLimit(key, fallbackLimit, windowMs)
}

/** Rightmost non-empty entry of a comma-separated header value. */
function rightmostEntry(value: string): string {
  const parts = value.split(",").map((p) => p.trim()).filter(Boolean)
  return parts[parts.length - 1] ?? ""
}

/**
 * Client IP for rate-limit keys.
 *
 * x-vercel-forwarded-for is set by Vercel's edge and cannot be supplied by the
 * caller, so it is preferred. A raw x-forwarded-for CAN be: on any hop that
 * appends rather than replaces, the LEFTMOST entry is whatever the client
 * sent, so keying on it lets an attacker mint a fresh bucket per request and
 * bypass the limit entirely. When we do fall back to XFF we take the RIGHTMOST
 * entry, the address the nearest trusted proxy actually observed. An
 * unidentifiable caller collapses into the shared "unknown" bucket, which errs
 * toward limiting too much rather than too little.
 */
export function clientIp(request: Request): string {
  const trusted =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-real-ip")
  if (trusted) {
    const ip = rightmostEntry(trusted)
    if (ip) return ip
  }
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    const ip = rightmostEntry(forwarded)
    if (ip) return ip
  }
  return "unknown"
}
