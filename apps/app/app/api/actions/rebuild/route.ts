import { createServiceClient } from "@/lib/supabase/server"
import { rateLimit } from "@/lib/rate-limit"
import { actionsGate, effectiveMaxSwapUsd } from "@/lib/actions-gate"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { prepareSwap, prepareContractAction } from "@txid/ai"
import type { ActionsContext } from "@txid/ai"
import { checkSanctioned } from "@txid/blockchain"

// Rebuilds a prepared action after its approval step confirms (or after a
// quote expired): fresh quote/estimate, full policy re-gate, same action id.
// The server-persisted params are authoritative — the client sends only ids.

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

const MAX_ACTION_AGE_MS = 15 * 60_000

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown"
    const { allowed } = await rateLimit(`actions-rebuild:${ip}`, 10, 60_000)
    if (!allowed) return json(429, { error: "Too many requests" })

    const { key, sessionId, actionId } = (await request.json()) as { key?: string; sessionId?: string; actionId?: string }
    if (!key || !sessionId || !actionId) return json(400, { error: "Invalid request" })

    const supabase = createServiceClient()
    const { data: project } = await supabase
      .from("projects")
      .select("id, config")
      .eq("publishable_key", key)
      .single()
    if (!project) return json(401, { error: "Invalid key" })
    const typed = project as { id: string; config: unknown }
    const config = typed.config as ProjectConfig
    const plan = (config.plan ?? "free") as Plan

    const { data: row } = await supabase
      .from("action_events")
      .select("id, kind, chain, summary, params, status, created_at")
      .eq("action_id", actionId)
      .eq("project_id", typed.id)
      .eq("session_id", sessionId)
      .maybeSingle()
    if (!row) return json(404, { error: "Unknown action" })
    const r = row as { id: string; kind: string; chain: string; summary: string; params: Record<string, unknown>; status: string; created_at: string }
    if (r.kind === "ack") return json(400, { error: "Invalid action" })
    if (["confirmed", "failed", "expired"].includes(r.status)) return json(410, { error: "This action is finished. Ask again for a fresh one." })

    if (Date.now() - new Date(r.created_at).getTime() > MAX_ACTION_AGE_MS) {
      await supabase.from("action_events").update({ status: "expired", updated_at: new Date().toISOString() } as never).eq("id", r.id)
      return json(410, { error: "This action has expired. Ask again for a fresh one." })
    }

    const wallet = (r.params?._wallet ?? null) as { address?: string; chainId?: string } | null
    if (!wallet?.address || !wallet.chainId) return json(400, { error: "Action is missing wallet context" })

    // Full policy re-gate + fail-closed OFAC re-screen.
    const gate = actionsGate(request, config, plan, false, "connected")
    if (!gate.allowed) return json(403, { error: "Actions are not available right now." })
    const screening = await checkSanctioned(wallet.address)
    if (screening === null || screening.sanctioned) return json(403, { error: "Actions are not available for this wallet." })

    const ctx: ActionsContext = {
      allowedFunctions: Object.fromEntries(
        Object.entries(config.actions?.allowedFunctions ?? {}).map(([cid, rules]) => [
          cid,
          rules.map(rule => ({ fn: rule.fn, ...(rule.approval ? { approval: rule.approval } : {}) })),
        ]),
      ),
      maxSwapUsd: effectiveMaxSwapUsd(config),
      projectToken: config.token
        ? { address: config.token.address, symbol: config.token.symbol ?? "TOKEN", chain: config.token.chain }
        : null,
      persistAction: async () => {},
    }
    const walletConfig = { address: wallet.address, chainId: wallet.chainId }
    const watched = (config.watchedContracts ?? []).map(c => ({
      id: c.id, name: c.name, address: c.address, chain: c.chain, description: c.description,
      ...(c.abi ? { abi: c.abi } : {}),
    }))

    const build = async (): Promise<Record<string, unknown>> =>
      r.kind === "swap"
        ? prepareSwap(
            { fromToken: String(r.params.fromToken ?? ""), toToken: String(r.params.toToken ?? ""), amount: String(r.params.amount ?? "") },
            walletConfig, ctx, actionId,
          )
        : prepareContractAction(
            { contract: String(r.params.contract ?? ""), fn: String(r.params.fn ?? ""), args: (r.params.args as string[] | undefined) ?? [] },
            walletConfig, watched, ctx, actionId,
          )

    // One retry after 2s: the approval receipt can be a block ahead of our RPC,
    // making the first re-estimate revert on allowance. Not a real failure.
    let result = await build()
    if (result.error) {
      await new Promise(res => setTimeout(res, 2000))
      result = await build()
    }
    if (result.error) return json(422, { error: String(result.error) })

    await supabase.from("action_events").update({ status: "rebuilt", updated_at: new Date().toISOString() } as never).eq("id", r.id)
    return json(200, { action: (result as { clientAction: unknown }).clientAction })
  } catch {
    return json(500, { error: "Internal error" })
  }
}
