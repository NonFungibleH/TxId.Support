import type { ProjectConfig } from "@/lib/types/config"
import { isPaidPlan, ACTIONS_MAX_SWAP_USD_DEFAULT, ACTIONS_MAX_SWAP_USD_CEILING } from "@/lib/types/config"
import type { Plan } from "@/lib/types/config"

// Server-side policy gate for the "Actions" feature. Every condition is
// enforced here (not in the prompt): a compromised prompt cannot enable
// action tools. Geo is fail-closed in production; sanctions screening happens
// per tool invocation in packages/ai (also fail-closed).

// Policy choice (not an OFAC quote): comprehensively-sanctioned jurisdictions
// plus RU, and the occupied UA regions via the region header.
const BLOCKED_COUNTRIES = new Set(["CU", "IR", "KP", "SY", "RU"])
const BLOCKED_UA_REGIONS = new Set(["43", "40", "14", "09"]) // Crimea, Sevastopol, Donetsk, Luhansk

export interface ActionsGateResult {
  allowed: boolean
  country: string | null
}

export function actionsGate(
  request: Request,
  config: ProjectConfig,
  plan: Plan,
  isDemoSession: boolean,
  walletMode: string | undefined,
): ActionsGateResult {
  const country = request.headers.get("x-vercel-ip-country")
  const region = request.headers.get("x-vercel-ip-country-region")

  if (!config.actions?.enabled) return { allowed: false, country }
  if (!isPaidPlan(plan) || plan === "demo") return { allowed: false, country }
  if (config.publicDemo === true || isDemoSession) return { allowed: false, country }
  if (walletMode !== "connected") return { allowed: false, country }

  if (!country) {
    if (process.env.ACTIONS_GEO_DEV_BYPASS === "1") return { allowed: true, country: null }
    return { allowed: false, country }
  }
  if (BLOCKED_COUNTRIES.has(country)) return { allowed: false, country }
  if (country === "UA" && region && BLOCKED_UA_REGIONS.has(region)) return { allowed: false, country }

  return { allowed: true, country }
}

export function effectiveMaxSwapUsd(config: ProjectConfig): number {
  const raw = config.actions?.maxSwapUsd
  if (raw === undefined || raw === null || Number.isNaN(raw)) return ACTIONS_MAX_SWAP_USD_DEFAULT
  return Math.max(0, Math.min(ACTIONS_MAX_SWAP_USD_CEILING, raw))
}
