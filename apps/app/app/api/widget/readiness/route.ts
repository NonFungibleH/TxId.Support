import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import type { ProjectConfig } from "@/lib/types/config"
import { activationOn } from "@/lib/types/config"
import { originAllowed } from "@/lib/origin-guard"
import { buildChecklist, failureItem, type WalletFacts } from "@/lib/activation/readiness"
import { assignArm, classifyWallet, type CohortRow } from "@/lib/activation/cohort"
import { resolveActionChain, readProtocolHistory, readWalletFacts, recentFailure } from "@/lib/activation/facts"
import { loadOrCreate, applyUpdate, recordEvent } from "@/lib/activation/store"

/**
 * GET /api/widget/readiness?key=pk_…&address=0x…&chainId=…[&failure=0x…][&only=progress]
 *
 * Whether this wallet is new to the protocol, which group it is in, and, for
 * the group that sees it, the readiness checklist. 204 when activation is off
 * for the project, which is every project until one turns it on.
 *
 * `only=progress` is the cheap re-check the widget polls while a new wallet
 * has the page open: history only, to notice the first success or a failure,
 * without re-reading every balance each minute.
 *
 * Every wallet read is tri-state (see lib/activation/facts.ts), and a failed
 * lookup is reported as `state: "unknown"` or as "couldn't check" items, never
 * as a finding about the wallet.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/
const TX_HASH = /^0x[0-9a-fA-F]{64}$/

export const dynamic = "force-dynamic"
export const maxDuration = 20

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function nothing() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Cache-Control": "private, no-store" },
  })
}

function isPublicSurface(key: string, config: { publicDemo?: boolean } | null | undefined): boolean {
  const a = process.env.DEMO_WIDGET_KEY
  const b = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY
  return (!!a && key === a) || (!!b && key === b) || config?.publicDemo === true
}

export async function GET(request: Request) {
  // Same budget as the opener: unauthenticated chain reads we pay for. The
  // widget polls at most once a minute for a quarter of an hour, which sits
  // well inside it.
  const { allowed } = await rateLimit(`readiness:${clientIp(request)}`, 30, 60_000)
  if (!allowed) return nothing()

  const url = new URL(request.url)
  const key = url.searchParams.get("key")
  const address = url.searchParams.get("address")
  const chainId = url.searchParams.get("chainId")
  const failureHash = url.searchParams.get("failure")
  const progressOnly = url.searchParams.get("only") === "progress"

  if (!key?.startsWith("pk_") || !address || !EVM_ADDRESS.test(address)) return nothing()

  const supabase = createServiceClient()
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, config")
    .eq("publishable_key", key)
    .maybeSingle()
  if (!project) return nothing()

  const typed = project as unknown as { id: string; name: string; config: ProjectConfig }
  const config = typed.config ?? ({} as ProjectConfig)
  if (!originAllowed(request, config.allowedDomains, { publicSurface: isPublicSurface(key, config) })) {
    return nothing()
  }
  if (!activationOn(config) || !config.activation) return nothing()
  const activation = config.activation

  // v1 is EVM only. A protocol whose action chain we cannot read in full gets
  // silence rather than a checklist built on a history we know is partial.
  const chain = resolveActionChain(config)
  if (!chain) return nothing()

  try {
    const now = Date.now()
    const arm = assignArm(typed.id, address, activation.holdoutPct)

    const [history, stored] = await Promise.all([
      readProtocolHistory(config, address),
      loadOrCreate(typed.id, address, chain.id, arm),
    ])
    // No table yet, or the database did not answer: judge against a wallet
    // first seen NOW. That is the conservative reading, because any success
    // already in its history then makes it existing, never new.
    const row: Pick<CohortRow, "status" | "first_seen_at" | "activated_at"> =
      stored ?? { status: "pending", first_seen_at: new Date(now).toISOString(), activated_at: null }
    const update = classifyWallet(row, history, now)
    if (stored) await applyUpdate(typed.id, address, update)

    const status = update.status ?? row.status
    const activatedAt = update.activated_at ?? row.activated_at

    if (status === "existing") return json({ arm, state: "existing" })
    if (activatedAt) return json({ arm, state: "activated", action: activation.action })
    if (history.kind !== "ok") return json({ arm, state: "unknown" })

    // Holdout wallets are recorded and re-checked exactly like the rest. They
    // are simply never shown anything, which is the whole comparison.
    if (arm === "holdout") return json({ arm, state: status })

    const hostFailure: WalletFacts["failure"] =
      failureHash && TX_HASH.test(failureHash) ? { source: "host", hash: failureHash } : null
    const failure = hostFailure ?? recentFailure(history, now)
    if (failure && stored) await recordEvent(typed.id, address, "failure_seen")

    if (progressOnly) {
      return json({
        arm,
        state: status,
        ...(failure ? { failure: failureItem(failure, typed.name) } : {}),
      })
    }

    const facts = await readWalletFacts(config, activation, address, chainId, chain, failure)
    const checklist = buildChecklist({
      projectName: typed.name,
      action: activation.action,
      spends: activation.spends,
      actionChain: chain,
      facts,
    })
    return json({
      arm,
      state: status,
      action: activation.action,
      checklist,
      ...(activation.guideUrl ? { guideUrl: activation.guideUrl } : {}),
    })
  } catch {
    // A proactive nicety never becomes a visible error.
    return nothing()
  }
}
