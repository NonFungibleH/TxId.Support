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

/**
 * An admin-created demo (Demo Creator) that has Actions explicitly turned on, so
 * it can showcase the execute flow. It bypasses the paid-plan + publicDemo
 * exclusions BUT keeps every safety rail (wallet-connected, geo, per-invocation
 * OFAC screening, caps). Only ever true when the admin flips the toggle: the
 * public /check demo and the marketing widget never set config.actions.enabled.
 */
export function isActionDemo(config: ProjectConfig): boolean {
  return config.publicDemo === true && config.actions?.enabled === true
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
  const actionDemo = isActionDemo(config)
  // Normal projects: paid plan + not a demo/publicDemo. Action-demos skip these
  // two gates only (the admin opted in); all rails below still apply.
  if (!actionDemo) {
    if (!isPaidPlan(plan) || plan === "demo") return { allowed: false, country }
    if (config.publicDemo === true || isDemoSession) return { allowed: false, country }
  }
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
