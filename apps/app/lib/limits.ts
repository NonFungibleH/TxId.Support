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
  /** Max prior messages sent to the model (context/cost cap). */
  maxHistoryMessages: 30,
  /** Max characters kept per message. */
  maxMessageChars: 2000,
  /** User turns allowed per session before it must be restarted. */
  sessionMessages: 30,
  /** Stricter session cap for the public demo key. */
  demoSessionMessages: 10,
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
 * Per-project DAILY conversation ceiling — a circuit-breaker so a single
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
