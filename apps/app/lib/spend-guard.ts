// Daily spend circuit breaker.
//
// Per-turn token usage is recorded into token_usage, but nothing read it to
// make a decision: between "an attacker starts draining credits" and "the
// Anthropic invoice arrives" there was no automatic stop. This is that stop.
//
// Checked by /api/chat BEFORE any model call, against two ceilings for the
// current UTC day (both in lib/limits.ts, both env-overridable):
//   - per project:  one leaked publishable key can't burn the whole budget
//   - platform-wide: total exposure across every project has a hard roof
//
// Cost of the guard itself matters as much as what it guards: it must not
// become a full table scan per request during exactly the flood it exists to
// stop. So it is one aggregate SQL call (daily_token_spend), cached in-process
// for SPEND_LIMITS.cacheMs, and a known platform breach short-circuits before
// any query at all.

import { SPEND_LIMITS } from "@/lib/limits"
import { log } from "@/lib/logger"
import type { createServiceClient } from "@/lib/supabase/server"

export type SpendBudgetResult =
  | { allowed: true }
  | { allowed: false; scope: "project" | "platform" }

interface CacheEntry {
  tokens: number
  expiresAt: number
}

const projectCache = new Map<string, CacheEntry>()
// The platform total is shared by every project, so it is cached once and
// refreshed by whichever project's read happens to run next.
let platformTokens = 0
let platformExpiresAt = 0

/** Stops the per-project cache growing without bound (one entry per key seen). */
const MAX_CACHED_PROJECTS = 2000

function platformBreached(now: number): boolean {
  return now < platformExpiresAt && platformTokens >= SPEND_LIMITS.dailyTokensPlatform
}

/**
 * Pre-flight budget check for one project. Returns `allowed: false` only when a
 * ceiling is genuinely breached.
 *
 * Fails OPEN on any error: a failed count must never take chat down for
 * everyone. Failures are logged at error level with event
 * "spend_guard.query_failed" so they can be alerted on, since a guard that is
 * quietly failing open is the same as having no guard.
 */
export async function checkSpendBudget(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
): Promise<SpendBudgetResult> {
  const now = Date.now()

  // Already known to be over the platform ceiling: block without a query, so a
  // flood that trips the breaker can't also drive one query per request.
  if (platformBreached(now)) return { allowed: false, scope: "platform" }

  const cached = projectCache.get(projectId)
  if (cached && now < cached.expiresAt) {
    return cached.tokens >= SPEND_LIMITS.dailyTokensProject
      ? { allowed: false, scope: "project" }
      : { allowed: true }
  }

  let projectTokens: number
  let platform: number
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("daily_token_spend", { p_project_id: projectId })
    if (error) throw new Error(String(error.message ?? error))
    const row = (Array.isArray(data) ? data[0] : data) as
      | { project_tokens?: number | string; platform_tokens?: number | string }
      | null
      | undefined
    projectTokens = Number(row?.project_tokens ?? 0)
    platform = Number(row?.platform_tokens ?? 0)
    if (!Number.isFinite(projectTokens) || !Number.isFinite(platform)) throw new Error("Malformed totals")
  } catch (err) {
    log.error("Spend guard query failed, failing open", err, {
      event: "spend_guard.query_failed",
      projectId,
    })
    // Short negative cache: keeps a broken query off the hot path without
    // leaving the breaker disabled for long.
    rememberProject(projectId, 0, now + SPEND_LIMITS.errorCacheMs)
    return { allowed: true }
  }

  rememberProject(projectId, projectTokens, now + SPEND_LIMITS.cacheMs)
  platformTokens = platform
  platformExpiresAt = now + SPEND_LIMITS.cacheMs

  if (platform >= SPEND_LIMITS.dailyTokensPlatform) {
    // Logged once per cache window, not once per blocked request.
    log.error("Daily platform token budget exceeded, chat blocked", undefined, {
      event: "spend_guard.platform_breach",
      platformTokens: platform,
      budget: SPEND_LIMITS.dailyTokensPlatform,
    })
    return { allowed: false, scope: "platform" }
  }

  if (projectTokens >= SPEND_LIMITS.dailyTokensProject) {
    log.warn("Daily project token budget exceeded, chat blocked", {
      event: "spend_guard.project_breach",
      projectId,
      projectTokens,
      budget: SPEND_LIMITS.dailyTokensProject,
    })
    return { allowed: false, scope: "project" }
  }

  return { allowed: true }
}

function rememberProject(projectId: string, tokens: number, expiresAt: number): void {
  if (projectCache.size >= MAX_CACHED_PROJECTS && !projectCache.has(projectId)) projectCache.clear()
  projectCache.set(projectId, { tokens, expiresAt })
}
