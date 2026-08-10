// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH FOR EVERY USAGE LIMIT
//
// Everything that caps usage lives here so it can be read and tuned in one
// place instead of hunting through the chat/tickets/telegram routes. Plan-based
// conversation + chain limits are defined in lib/types/config.ts (next to the
// Plan type) and re-exported below so this file is still the one screen to
// look at.
// ─────────────────────────────────────────────────────────────────────────────

import type { Plan } from "@/lib/types/config"
import { PLAN_CONV_LIMITS, PLAN_CHAIN_LIMITS } from "@/lib/types/config"

// Re-exported so callers can `import { PLAN_CONV_LIMITS } from "@/lib/limits"`
// and see it alongside everything else.
export { PLAN_CONV_LIMITS, PLAN_CHAIN_LIMITS }

/** Chat endpoint (`/api/chat`). */
export const CHAT_LIMITS = {
  /** Requests per IP per window (distributed via Upstash when configured). */
  ratePerWindow: 20,
  windowMs: 60_000,
  /** Aggregate ceiling per publishable key, independent of IP. The per-IP
   *  limit alone gives a distributed attacker (proxy pool, IPv6 /64) with a
   *  copied key no ceiling at all: each source gets its own bucket. This caps
   *  total spend attributable to one key however many IPs it arrives from.
   *  Sized well above any real single-site widget load. */
  ratePerKeyPerWindow: 300,
  /** Max prior messages sent to the model (context/cost cap). */
  maxHistoryMessages: 30,
  /** Max characters kept per message. A tx hash (66) + address (42) + a short
   *  sentence fits comfortably; anything longer is pasted logs/spam. */
  maxMessageChars: 500,
  /** User turns allowed per session. On the 10th the bot escalates to a human
   *  ticket and the conversation ends (see /api/chat cap handoff). */
  sessionMessages: 10,
  /** Stricter session cap for the public demo key. Matches the
   *  inspect:${ip} daily rate limit in /api/chat - both must move together. */
  demoSessionMessages: 8,
  /** Caps applied instead of the two above when the DISTRIBUTED limiter is
   *  unavailable (Upstash unset, erroring, or timing out). The fallback counter
   *  is per lambda instance, so N concurrent instances would otherwise allow
   *  N x the intended rate. Deliberately tight: a degraded limiter is the one
   *  moment an attacker gets the most leverage. */
  // MUST STAY ABOVE `sessionMessages`, or the product's own designed flow trips
  // its own limiter: a session is allowed 10 user turns, each turn is one
  // request, so a degraded cap of 5 meant a single tester working quickly got
  // "Too many requests" at message 6 with nobody attacking anything. A team
  // testing from one office IP shares the bucket and hits it sooner still.
  // 12 is still well under the normal 20 and far under the per-key ceiling,
  // which is the actual spend guard. The real fix is configuring Upstash, at
  // which point this number stops being used at all.
  degradedRatePerWindow: 12,
  degradedRatePerKeyPerWindow: 60,
} as const

/**
 * Positive integer from the environment, falling back to `fallback` when the
 * var is unset or not a usable number (so a typo can't silently disable the
 * circuit breaker or set it to zero).
 */
function envPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name]
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback
}

/**
 * DAILY SPEND CIRCUIT BREAKER (lib/spend-guard.ts, enforced by /api/chat).
 *
 * Counts input + output tokens recorded in token_usage for the current UTC
 * day. Every other limit here caps requests or conversations; this one caps
 * the thing that actually costs money, and it is the last line of defence if
 * every other cap is somehow bypassed.
 *
 * Defaults, on Haiku pricing (roughly $1/M input, $5/M output), assuming a
 * mostly-input mix:
 *   DAILY_TOKEN_BUDGET_PROJECT  = 2,000,000 tokens/day  (~$2-$10 per project)
 *   DAILY_TOKEN_BUDGET_PLATFORM = 20,000,000 tokens/day (~$20-$100 total)
 * A busy real widget uses a small fraction of the per-project figure: a chat
 * turn is on the order of a few thousand tokens.
 *
 * Both are overridable per deployment via those env vars. Raise them when real
 * traffic approaches the ceiling; a breach returns 503 from /api/chat and no
 * model call is made.
 */
export const SPEND_LIMITS = {
  dailyTokensProject: envPositiveInt("DAILY_TOKEN_BUDGET_PROJECT", 2_000_000),
  dailyTokensPlatform: envPositiveInt("DAILY_TOKEN_BUDGET_PLATFORM", 20_000_000),
  /** How long a totals read is reused before the guard queries again. Keeps
   *  the check off the per-request hot path: one query per project per minute
   *  however many requests arrive. */
  cacheMs: 60_000,
  /** Shorter reuse window after a FAILED totals read. The guard fails open, so
   *  this bounds how long a transient error leaves us unprotected while still
   *  stopping a broken query from being retried on every request. */
  errorCacheMs: 15_000,
} as const

/**
 * Telegram webhook (`/api/telegram/[key]`). The monthly conversation quota
 * counts CONVERSATIONS, and a Telegram chat is one long-lived conversation, so
 * without a per-message limit a single busy (or malicious) chat could drive
 * unlimited model calls. Applied per chat and per sender so one abusive user
 * can't starve a legitimate group.
 */
export const TELEGRAM_LIMITS = {
  perChatPerWindow: 20,
  /** Tighter than the widget: each Telegram message can now run the full
   *  tool loop (up to 5 model rounds + on-chain reads), so one message costs
   *  several times a plain completion. */
  perUserPerWindow: 5,
  windowMs: 60_000,
} as const

/** Ticket creation endpoint (`/api/tickets`). */
export const TICKET_LIMITS = {
  /** Submissions per IP per window (email/webhook side-effect → stricter). */
  ratePerWindow: 5,
  windowMs: 10 * 60_000,
  maxSummaryChars: 500,
  maxConversationMsgs: 30,
  maxMessageChars: 2000,
} as const

/**
 * Per-project DAILY conversation ceiling - a circuit-breaker so a single
 * customer's traffic spike (or abuse of a leaked key) can't burn a whole
 * month's allowance in one day. Even "unlimited" plans get a daily ceiling.
 * A value of Infinity means no daily cap.
 */
export const PLAN_DAILY_CONV_LIMITS: Record<Plan, number> = {
  free:       50,     // == monthly, so the monthly cap is what bites
  starter:    100,
  pro:        500,
  enterprise: 5000,   // "unlimited" plans still get a spike breaker
  custom:     5000,
  demo:       5000,
}

/** Resolve the monthly + daily conversation limits for a plan. Infinity = none. */
export function conversationLimitsFor(plan: Plan): { monthly: number; daily: number } {
  return {
    monthly: PLAN_CONV_LIMITS[plan] ?? PLAN_CONV_LIMITS.free,
    daily: PLAN_DAILY_CONV_LIMITS[plan] ?? PLAN_DAILY_CONV_LIMITS.free,
  }
}
