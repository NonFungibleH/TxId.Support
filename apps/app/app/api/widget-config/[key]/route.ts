import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { isPaidPlan, resolveDisclaimer, activeStatusNotice, activeBeta, betaControls } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"
import { verifyPreviewToken } from "@/lib/preview-token"
import { isActionDemo } from "@/lib/actions-gate"
import { originAllowed, originRefused } from "@/lib/origin-guard"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * GET /api/widget-config/[key]
 *
 * Returns the safe-to-expose widget configuration for a publishable key.
 * Only includes branding, chain list, token symbol/chain - never secret_key.
 */
export async function GET(
  request: Request,
  { params }: { params: { key: string } },
) {
  const { key } = params
  const url = new URL(request.url)
  const preview = url.searchParams.get("preview") === "1"
  const previewToken = url.searchParams.get("pt")

  if (!key || !key.startsWith("pk_")) {
    return new Response(JSON.stringify({ error: "Invalid key" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  const supabase = createServiceClient()

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, config, is_active, mode")
    .eq("publishable_key", key)
    .single()

  if (error || !project) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }

  const typedProject = project as unknown as ProjectRow & { name: string; is_active: boolean }

  if (!typedProject.is_active) {
    if (!preview || !verifyPreviewToken(typedProject.id, previewToken)) {
      return new Response(JSON.stringify({ error: "Project inactive" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }
  }

  const config = typedProject.config as unknown as ProjectConfig

  // ── Domain enforcement ──────────────────────────────────────────────────
  // THE SHARED GUARD, not a second copy of it. This route had its own inline
  // check that compared the request's own Origin/Referer against the
  // allowlist, which is the exact bug already fixed in lib/origin-guard.ts:
  // the widget runs in an iframe on our own domain and fetches this config
  // SAME-ORIGIN, so the browser sends no Origin and a Referer of
  // app.txid.support. The first customer to add their domain would have got
  // "Domain not registered for this key" and a widget that never loaded,
  // having done exactly what the dashboard told them to do. Verified against a
  // live browser: same-origin fetch = no Origin header, Referer = our own host.
  //
  // The guard ignores our own origin and falls through to the host reported by
  // widget.js in the iframe URL, which is the only party that can see it.
  // Public by design: the shared demo key, and any project flagged publicDemo,
  // exist to be embedded anywhere. Recognised by the key OR the plan OR the
  // flag, so it still works when the demo env var is not mirrored here.
  const isDemoKey = (!!process.env.DEMO_WIDGET_KEY && key === process.env.DEMO_WIDGET_KEY)
    || (!!process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY && key === process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY)
  const isDemo = isDemoKey || (config.plan ?? "free") === "demo" || config.publicDemo === true

  const hostParam = url.searchParams.get("h")
  if (!originAllowed(request, config.allowedDomains, {
    preview,
    publicSurface: isDemo,
    ...(hostParam ? { hostPage: `https://${hostParam}` } : {}),
  })) {
    return originRefused(CORS_HEADERS)
  }

  // Only return safe fields - never secret_key, org_id, etc.
  const publicConfig = {
    projectId: typedProject.id,
    projectName: typedProject.name,
    mode: (typedProject as unknown as { mode?: string }).mode ?? "support",
    // Paid/hand-provisioned plans hide the "Powered by TxID" badge;
    // the free trial always shows it. Derived server-side from the plan.
    hidePoweredBy: isPaidPlan((config.plan ?? "free") as Plan),
    branding: config.branding,
    // Beta programme, resolved for expiry HERE so a finished beta stops
    // behaving like one without anyone editing config. Only the fields the
    // widget needs: no end date, nothing a tester should see.
    beta: (() => {
      const b = activeBeta(config)
      if (!b) return null
      // Resolved HERE, so the widget receives two plain booleans and the
      // inherit rule lives in one place rather than in every consumer.
      const c = betaControls(b)
      return { autoOpen: b.autoOpen === true, feedback: c.feedback, bugReports: c.bugs, intro: b.intro ?? null }
    })(),
    chains: [...new Set([
      ...(config.watchedContracts ?? []).map(c => c.chain as string),
      ...(config.token?.chain ? [config.token.chain as string] : []),
    ])],
    token: config.token
      ? {
          symbol: config.token.symbol,
          chain: config.token.chain,
          dexUrl: config.token.dexUrl,
          address: config.token.address,
          showInWidget: config.token.showInWidget === true,
        }
      : null,
    community: config.community ?? null,
    // Curated chips. Non-empty means the widget uses these instead of the
    // AI-generated follow-ups, so no chip can offer a nonexistent feature.
    suggestedQuestions: (config.suggestedQuestions ?? []).filter(q => q.trim().length > 0).slice(0, 6),
    // Actions availability only - the function allowlist and caps stay
    // server-side. Mirrors the chat route's actionsGate: normal projects need a
    // paid, non-demo plan; admin action-demos are the deliberate exception.
    actions: {
      enabled:
        config.actions?.enabled === true &&
        (isActionDemo(config) ||
          (isPaidPlan((config.plan ?? "free") as Plan) &&
            (config.plan ?? "free") !== "demo" &&
            config.publicDemo !== true)),
    },
    // Whether this protocol keeps user funds in a per-user account object. The
    // address itself is resolved per wallet at connect time, not here.
    subaccounts: { enabled: config.subaccounts?.enabled === true },
    tokenModeAsk: config.tokenModeAsk ?? null,
    welcomeMessage: config.branding?.welcomeMessage ?? null,
    // Resolved server-side so the widget never has to know the default, and an
    // old cached widget cannot end up showing nothing.
    disclaimer: resolveDisclaimer(config.branding),
    // Expiry resolved here, so a cached widget can never keep showing a notice
    // the team has already let lapse.
    statusNotice: (() => {
      const n = activeStatusNotice(config)
      return n ? { level: n.level, message: n.message, topics: n.topics ?? [] } : null
    })(),
    watchedContracts: (config.watchedContracts ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      chain: c.chain,
      description: c.description,
      address: c.address,
    })),
    contentBlocks: (config.contentBlocks ?? [])
      .sort((a, b) => a.order - b.order)
      .map((b) => ({
        id: b.id,
        type: b.type,
        title: b.title,
        content: b.content,
        order: b.order,
      })),
  }

  return new Response(JSON.stringify(publicConfig), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=15",
    },
  })
}
