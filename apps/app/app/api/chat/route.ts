import { waitUntil } from "@vercel/functions"
import { originAllowed } from "@/lib/origin-guard"
import { createServiceClient } from "@/lib/supabase/server"
import { answerFingerprint, chainStateAt, coarseDevice, requestGeo, userSuppliedHashes, documentationSources, type AnswerEvidence } from "@/lib/evidence"
import { unverifiedNumbers } from "@/lib/numeric-check"
import { mergeToolEvidence, type ToolEvidence } from "@txid/ai"
import { buildSystemPrompt, buildDocsBlock, retrieveContext, streamChatWithTools, generateSuggestions } from "@txid/ai"
import { resolveProtocolAccount } from "@/lib/protocol-account"
import type { ChatMessage, ProjectConfigSnapshot, ActionsContext } from "@txid/ai"
import { actionsGate, effectiveMaxSwapUsd } from "@/lib/actions-gate"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_SESSION_MESSAGE_LIMITS, activeStatusNotice, activeBeta, betaControls } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"
import { verifyPreviewToken } from "@/lib/preview-token"
import { rateLimit, clientIp } from "@/lib/rate-limit"
import { checkSpendBudget } from "@/lib/spend-guard"
import { log } from "@/lib/logger"
import { CHAT_LIMITS, conversationLimitsFor } from "@/lib/limits"
import { fetchAbiWithProxy, fetchAbiFromExplorer } from "@txid/blockchain"
import { demoContractsFor, demoContractDescription, DEMO_PROTOCOLS } from "@/lib/demo-protocols"

// An agentic answer runs up to 5 model rounds with live chain reads in
// between, and protocol-account questions (Decibel resolves a subaccount,
// then reads collateral, positions and history) sit at the heavy end. The
// platform default cuts that off mid-answer, so raise it: streaming keeps
// the connection open but the function still has to be allowed to live.
// 300, not 60: a worst-case turn (5 tool rounds x up to 25s tool timeout,
// plus the model streams and the suggestions call) arithmetically clears 60s,
// and Vercel killed it mid-stream with no [DONE], no error event and no
// persist. Fluid Compute is enabled on this project, which allows 300.
export const maxDuration = 300

// The public demo key. Checks BOTH env names so the exemption works whether
// Vercel has DEMO_WIDGET_KEY, NEXT_PUBLIC_DEMO_WIDGET_KEY, or both set to it.
function isDemoKey(key: string): boolean {
  const a = process.env.DEMO_WIDGET_KEY
  const b = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY
  return (!!a && key === a) || (!!b && key === b)
}

// Public inspect tool: convert a decimal or hex chain id to our hex form.
function toHexChain(chainId: string | undefined): string {
  if (!chainId) return "0x1"
  if (chainId.startsWith("0x")) return chainId.toLowerCase()
  const n = Number(chainId)
  return Number.isFinite(n) ? "0x" + n.toString(16) : "0x1"
}

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

// Allow cross-origin requests from any embedded site
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  const turnStartedAt = Date.now()
  try {
    const ip = clientIp(request)
    // Country resolved at the edge; the IP above is used only for rate
    // limiting and is never persisted. See lib/evidence.ts.
    const requestEvidence = {
      geo: requestGeo(request.headers),
      device: coarseDevice(request.headers.get("user-agent")),
      startedAt: turnStartedAt,
    } as {
      geo: ReturnType<typeof requestGeo>
      device: ReturnType<typeof coarseDevice>
      startedAt: number
      pageUrl?: string
      viewport?: string
    }

    const { allowed } = await rateLimit(`chat:${ip}`, CHAT_LIMITS.ratePerWindow, CHAT_LIMITS.windowMs, {
      degradedLimit: CHAT_LIMITS.degradedRatePerWindow,
    })
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
        status: 429,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Retry-After": "60" },
      })
    }

    const body = (await request.json()) as {
      key: string
      sessionId: string
      messages: ChatMessage[]
      walletAddress?: string
      chainId?: string
      preview?: boolean
      previewToken?: string
      turnstileToken?: string
      contractAddress?: string
      demoProtocol?: string
      walletMode?: string
      actionResult?: { actionId?: string; txHash?: string; status?: string; gasUsed?: string; blockNumber?: string }
      /** Host page context from the embed. Untrusted: validated below. */
      pageContext?: { url?: string; vw?: number; vh?: number }
      visitorId?: string
    }

    const { key, sessionId, messages, walletAddress, chainId, preview, previewToken, turnstileToken, contractAddress, demoProtocol, walletMode, actionResult, pageContext, visitorId } = body

    // Host page context, client-supplied and therefore validated: an http(s)
    // URL only, length-capped, viewport reduced to "WxH". It records where the
    // tester was, which is the difference between a finding a team can act on
    // and one they first have to reproduce.
    if (typeof pageContext?.url === "string" && /^https?:\/\//i.test(pageContext.url)) {
      // Origin + path ONLY. Dapp query strings carry referral codes and
      // occasionally worse, and the record needs WHERE the tester was, not
      // what parameters they arrived with.
      try {
        const u = new URL(pageContext.url)
        requestEvidence.pageUrl = (u.origin + u.pathname).slice(0, 300)
      } catch { /* unparseable input from an untrusted page: store nothing */ }
    }
    if (Number.isFinite(pageContext?.vw) && Number.isFinite(pageContext?.vh)) {
      requestEvidence.viewport = `${Math.round(pageContext!.vw!)}x${Math.round(pageContext!.vh!)}`
    }

    if (!key || !sessionId || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // Second, IP-independent ceiling. The per-IP limit above does nothing
    // against a distributed attacker holding a copied publishable key, since
    // every source address gets its own bucket. This bounds the total spend
    // attributable to a single key no matter how many IPs it comes from.
    const { allowed: keyAllowed } = await rateLimit(
      `chat:key:${key}`,
      CHAT_LIMITS.ratePerKeyPerWindow,
      CHAT_LIMITS.windowMs,
      { degradedLimit: CHAT_LIMITS.degradedRatePerKeyPerWindow },
    )
    if (!keyAllowed) {
      log.warn("Chat key rate limited", { event: "chat.key_rate_limited", key: key.slice(0, 12) })
      return new Response(JSON.stringify({ error: "Too many requests. Please slow down." }), {
        status: 429,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Retry-After": "60" },
      })
    }

    // ── Layer 2: Turnstile bot validation (when token provided by client) ──────
    // Only enforced when TURNSTILE_SECRET_KEY is configured. Requests without a
    // token are allowed through so embedded protocol widgets aren't affected.
    // MANDATORY on public surfaces once configured. It used to run only when a
    // token happened to be present, so a scripted caller simply omitted the
    // field and skipped the bot check entirely: the defence protected exactly
    // the people who were not attacking. Enforced below, after the project is
    // known; this block still validates any token that IS supplied.
    if (turnstileToken && process.env.TURNSTILE_SECRET_KEY) {
      const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: process.env.TURNSTILE_SECRET_KEY,
          response: turnstileToken,
        }),
      })
      const verifyData = await verifyRes.json() as { success: boolean }
      if (!verifyData.success) {
        return new Response(JSON.stringify({ error: "Bot check failed. Please try again." }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
    }

    // Public "inspect / demo-protocol" scoping (the /check "try it live" tool)
    // is built AFTER the project is resolved, because whether it's allowed
    // depends on this being our demo project - recognised by the demo key OR the
    // "demo" plan, so it works even when the demo key env var isn't mirrored onto
    // this deployment. Declarations kept here so they stay in scope downstream.
    const inspectAddress = typeof contractAddress === "string" ? contractAddress.trim() : ""
    const demoProtocolId = typeof demoProtocol === "string" && DEMO_PROTOCOLS[demoProtocol] ? demoProtocol : ""
    let inspectContracts: ProjectConfigSnapshot["watchedContracts"] | null = null
    let inspectMode = false

    // Cap message history to prevent context-stuffing / runaway LLM costs.
    //
    // REJECT non-string content outright rather than passing it through: the
    // Anthropic API accepts content-block ARRAYS, so `content: [{type:"text",
    // text:"<200k chars>"}]` used to sail past the per-message character cap
    // entirely, re-sent on every tool round, inside the spend-guard's cache
    // window. The length cap only means anything if every message is a string.
    // Roles are pinned for the same reason: this array goes to the model as-is.
    for (const m of messages.slice(-CHAT_LIMITS.maxHistoryMessages)) {
      if (typeof m?.content !== "string" || (m.role !== "user" && m.role !== "assistant")) {
        return new Response(JSON.stringify({ error: "Malformed message history" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
    }
    const safeMessages = messages
      .slice(-CHAT_LIMITS.maxHistoryMessages)
      .map(m => ({ ...m, content: (m.content as string).slice(0, CHAT_LIMITS.maxMessageChars) }))

    // F2: validate wallet address format before it touches any downstream URL
    // Accepts EVM (0x + 40 hex), Solana (base58, 32-44 chars), or Aptos
    // (0x + 1-64 hex, only when the request says chainId "aptos"). This runs
    // before the project row loads, so it's format-only by design:
    // chain-membership is enforced implicitly downstream because tools only
    // run against the project's configured chains.
    const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/
    const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    const APTOS_ADDR = /^0x[0-9a-fA-F]{1,64}$/
    const validWalletFormat =
      !walletAddress ||
      EVM_ADDR.test(walletAddress) ||
      SOL_ADDR.test(walletAddress) ||
      (chainId === "aptos" && APTOS_ADDR.test(walletAddress))
    if (!validWalletFormat) {
      return new Response(JSON.stringify({ error: "Invalid wallet address" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const supabase = createServiceClient()

    // Look up project by publishable key
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, name, config, is_active, mode")
      .eq("publishable_key", key)
      .single()

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: "Invalid API key" }), {
        status: 401,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const typedProject = project as unknown as ProjectRow & { name: string; is_active: boolean }

    // `preview` is a client-supplied flag that bypasses BOTH the domain
    // allowlist and the conversation quota, so it is never taken on trust:
    // it only counts once the server-signed HMAC token verifies. An
    // unverified claim is silently downgraded to a normal request, which then
    // pays the full allowlist + quota cost. The dashboard preview always
    // sends the token alongside the flag, so legitimate previews are
    // unaffected.
    const previewVerified = preview === true && verifyPreviewToken(typedProject.id, previewToken)

    // Inactive projects are reachable ONLY through a verified preview.
    if (!typedProject.is_active && !previewVerified) {
      return new Response(JSON.stringify({ error: "Project is inactive" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // ── Daily spend circuit breaker ───────────────────────────────────────────
    // Last line of defence on cost: checked before RAG, before any ABI/RPC
    // fetch, and before the model call, so a breach costs nothing. Cached in
    // lib/spend-guard.ts, and fails open if the count itself errors. The
    // response deliberately says nothing about budgets or which ceiling was
    // hit, so it can't be used to probe our spend.
    const budget = await checkSpendBudget(supabase, typedProject.id)
    if (!budget.allowed) {
      log.warn("Chat blocked by spend guard", {
        event: "chat.spend_blocked",
        projectId: typedProject.id,
        scope: budget.scope,
      })
      return new Response(
        JSON.stringify({ error: "Support chat is temporarily unavailable. Please try again later." }),
        {
          status: 503,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json", "Retry-After": "3600" },
        },
      )
    }

    // ── Conversation quota (monthly + daily) + per-session message cap ────────
    // New sessions are admitted atomically by claim_conversation_slot (audit
    // H3): it locks per-project, checks the monthly AND daily caps against
    // committed rows, and inserts the conversation row in one transaction, so
    // concurrent new sessions can't all slip past the limit. Existing sessions
    // are already counted; they only face the per-session message cap. All
    // limits are defined in lib/limits.ts.
    const rawConfig = typedProject.config as unknown as ProjectConfig
    const plan = (rawConfig.plan ?? "free") as Plan

    // ── Actions follow-up (post-transaction) ──────────────────────────────
    // A widget-originated status report for a prepared action. Exempt from the
    // session cap and forced escalation (it is not a user turn); validated
    // against the audit row so the channel can't be forged.
    let validActionResult: { row: { summary: string | null }; txHash: string; confirmed: boolean; gasUsed?: string; blockNumber?: string } | null = null
    if (actionResult?.actionId && actionResult?.txHash && /^0x[0-9a-fA-F]{64}$/.test(actionResult.txHash)) {
      const { data: actionRow } = await supabase
        .from("action_events")
        .select("id, summary, status")
        .eq("action_id", actionResult.actionId)
        .eq("project_id", typedProject.id)
        .eq("session_id", sessionId)
        .maybeSingle()
      if (actionRow) {
        const confirmed = actionResult.status === "confirmed"
        await supabase
          .from("action_events")
          .update({ status: confirmed ? "confirmed" : "failed", tx_hash: actionResult.txHash, updated_at: new Date().toISOString() } as never)
          .eq("id", (actionRow as { id: string }).id)
        validActionResult = {
          row: actionRow as { summary: string | null },
          txHash: actionResult.txHash,
          confirmed,
          ...(actionResult.gasUsed ? { gasUsed: actionResult.gasUsed } : {}),
          ...(actionResult.blockNumber ? { blockNumber: actionResult.blockNumber } : {}),
        }
      }
    }

    // Our own demo project, recognised three ways: the demo key (when its env
    // var is set on this deployment), the "demo" plan, or the publicDemo flag on
    // the project row. The flag lets our demo project stay on "custom" (needed
    // for the marketing-site widget + admin) while still powering /check - set it
    // in /admin. This means /check works without mirroring the demo key env var
    // from the marketing site onto this API deployment.
    const isDemo = isDemoKey(key) || plan === "demo" || rawConfig.publicDemo === true
    // The HARD session cap is for anonymous, public surfaces only: the shared
    // demo key and publicDemo projects, where any browser on the internet can
    // burn spend. plan === "demo" is the opposite population, hand-provisioned
    // pilots and our own accounts, and lumping them in here once capped a
    // customer's beta testers at 8 messages, sized for drive-by traffic.
    const isPublicDemo = isDemoKey(key) || rawConfig.publicDemo === true

    // Domain allowlist - reject before claiming a conversation slot or calling
    // the LLM, so a copied key from a non-registered origin can't drain quota.
    // Exempt OUR own demo project: it powers the /demo + /check pages on the
    // marketing site (any origin by design) and is protected by the per-IP rate
    // cap + Turnstile, not the per-customer domain allowlist.
    if (!isDemo && !originAllowed(request, rawConfig.allowedDomains, {
      preview: previewVerified,
      ...(pageContext?.url ? { hostPage: pageContext.url } : {}),
    })) {
      return new Response(JSON.stringify({ error: "Domain not registered for this key" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // ── Public inspect / demo-protocol scoping (the /check "try it live" tool) ─
    // Only our demo project may point the bot at a curated protocol or a pasted
    // contract. Gated by Turnstile + a hard 3-per-IP-per-day cap so it can't be
    // abused or run up LLM/RPC cost. Real project keys never enter this mode, so
    // the normal scope guard is untouched for them.
    // EVM-only by design: the public /check inspect tool stays EVM (Aptos unsupported here).
    // A public surface with Turnstile configured must PRESENT a token, not
    // merely pass one if it feels like it.
    if (isPublicDemo && process.env.TURNSTILE_SECRET_KEY && !turnstileToken && !previewVerified) {
      log.warn("Public surface request without a bot check", {
        event: "chat.turnstile_missing", key: key.slice(0, 12),
      })
      return new Response(JSON.stringify({ error: "Bot check required." }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    inspectMode = isDemo && (!!demoProtocolId || /^0x[0-9a-fA-F]{40}$/.test(inspectAddress))
    if (inspectMode) {
      // Require a bot-check token when Turnstile is configured.
      if (process.env.TURNSTILE_SECRET_KEY && !turnstileToken) {
        return new Response(JSON.stringify({ error: "Please complete the bot check to run a diagnosis." }), {
          status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
      // Hard cap: 8 messages per IP per 24h. Server-enforced (a refresh, a new
      // session, or switching demo protocol can't reset it) so the public demo
      // can never run up our LLM/RPC cost. Matches CHAT_LIMITS.demoSessionMessages
      // below - both must move together or the tighter one silently wins.
      const daily = await rateLimit(`inspect:${ip}`, 8, 86_400_000)
      if (!daily.allowed) {
        return new Response(JSON.stringify({
          error: "That's the end of your free test. Add TxID to your own protocol to give your users this.",
          limitReached: true,
        }), { status: 429, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } })
      }
      if (demoProtocolId) {
        // Curated demo protocol (Uniswap / PancakeSwap): scope the bot to its
        // routers so it can diagnose the connected wallet's real swaps.
        const curated = demoContractsFor(demoProtocolId, toHexChain(chainId))
        const desc = demoContractDescription(demoProtocolId)
        inspectContracts = await Promise.all(
          curated.map(async (c, i) => {
            const abi = await fetchAbiWithProxy(c.address, c.chain, fetchAbiFromExplorer).catch(() => null)
            return {
              id: `demo-${i}`,
              name: c.name,
              address: c.address,
              chain: c.chain,
              description: desc,
              ...(abi ? { abi, abiSource: "explorer" as const } : {}),
            }
          }),
        )
      } else {
        const hexChain = toHexChain(chainId)
        const abi = await fetchAbiWithProxy(inspectAddress, hexChain, fetchAbiFromExplorer).catch(() => null)
        inspectContracts = [{
          id: "inspect",
          name: `Contract ${inspectAddress.slice(0, 6)}…${inspectAddress.slice(-4)}`,
          address: inspectAddress,
          chain: hexChain,
          description: "A smart contract the user pasted into the public diagnostics tool to inspect. Diagnose it with the tools: what it is, whether it's verified, when it was deployed, its events/state, and any token it represents (price, safety).",
          ...(abi ? { abi, abiSource: "explorer" as const } : {}),
        }]
      }
    }

    const existingConv = await supabase
      .from("conversations")
      .select("id")
      .eq("session_id", sessionId)
      .eq("project_id", typedProject.id)
      .maybeSingle()

    if (existingConv.data) {
      // Existing session - enforce the per-session message cap (stricter for
      // the public demo key).
      // The public demo key stays on the tightest cap; everyone else scales
      // with their plan, so a hand-provisioned customer isn't cut off
      // mid-diagnosis by a limit sized for anonymous traffic.
      const sessionCap = isPublicDemo
        ? CHAT_LIMITS.demoSessionMessages
        : (PLAN_SESSION_MESSAGE_LIMITS[plan] ?? CHAT_LIMITS.sessionMessages)
      const { count: msgCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", existingConv.data.id)
        .eq("role", "user")
      // Action follow-ups are not user turns - the cap never applies to them.
      if (!validActionResult && (msgCount ?? 0) >= sessionCap) {
        // Cap reached - don't cold-error the user out. Escalate to a human:
        // emit the same SSE `escalate` event the AI uses, which the widget
        // renders as its ticket form and ends the conversation gracefully.
        const enc = new TextEncoder()
        const capStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({
                  text: "We've covered a lot in this chat. So nothing gets lost, I'll hand you over to the team - drop your details below and someone will follow up with you directly.",
                })}\n\n`,
              ),
            )
            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({
                  escalate: {
                    summary:
                      "You've reached the message limit for this conversation. Leave your name and email and a team member will pick it up from here.",
                    reason: "message_limit",
                  },
                })}\n\n`,
              ),
            )
            controller.enqueue(enc.encode("data: [DONE]\n\n"))
            controller.close()
          },
        })
        // RECORD THE TURN THE USER ACTUALLY HAD. This branch used to return
        // without persisting anything, so the question that hit the limit and
        // the handoff the user was shown both existed only on their screen.
        // For a product whose claim is a complete record, a transcript that
        // omits the last thing we said is the wrong kind of gap: the
        // conversation reads as though it simply stopped, and support cannot
        // see that we cut it off rather than the user leaving.
        const CAP_HANDOFF =
          "We've covered a lot in this chat. So nothing gets lost, I'll hand you over to the team - drop your details below and someone will follow up with you directly."
        waitUntil(persistMessages(
          supabase, typedProject.id, sessionId,
          [...safeMessages, { role: "assistant" as const, content: CAP_HANDOFF }],
          walletAddress, chainId, undefined, null,
          { ...requestEvidence, surface: "widget" },
          visitorId,
        ))

        return new Response(capStream, {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }
    } else if (previewVerified) {
      // Preview sessions (dashboard testing) are recorded so the user can see
      // Conversations/Analytics working, but they never count toward the paid
      // conversation quota. persistMessages will create the conversation row.
    } else {
      // New session - atomically claim a slot against the monthly + daily caps.
      const { monthly, daily } = conversationLimitsFor(plan)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: slot, error: slotError } = await (supabase as any).rpc("claim_conversation_slot", {
        p_project_id: typedProject.id,
        p_session_id: sessionId,
        p_monthly_limit: monthly === Infinity ? -1 : monthly,
        p_daily_limit: daily === Infinity ? -1 : daily,
      })
      // The RPC missing (schema drift, a documented recurring failure here)
      // used to FAIL OPEN: `slot` came back undefined, neither branch fired,
      // and no cap was enforced at all, silently. Fall back to a plain count
      // so a drifted deployment still enforces the monthly ceiling; the
      // advisory-lock atomicity is lost in the fallback, the cap is not.
      let effectiveSlot: string | undefined = slot
      if (slotError && monthly !== Infinity) {
        log.error("claim_conversation_slot RPC failed; using fallback count", slotError, { event: "chat.quota_rpc_failed", projectId: typedProject.id })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase as any)
          .from("conversations")
          .select("id", { count: "exact", head: true })
          .eq("project_id", typedProject.id)
          .not("session_id", "like", "preview-%")
          .gte("created_at", new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString())
        effectiveSlot = typeof count === "number" && count >= monthly ? "month_limit" : "ok"
      }
      // NEUTRAL END-USER COPY. This message renders in the customer's widget
      // to the PROTOCOL'S user, who cannot upgrade anything; billing language
      // belongs in the dashboard, which has its own usage warnings.
      if (effectiveSlot === "month_limit" || effectiveSlot === "day_limit") {
        return new Response(JSON.stringify({ error: "The assistant is temporarily unavailable. Please try again later, or reach the team through their usual support channels." }), {
          status: 429,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
    }

    const config = typedProject.config as unknown as ProjectConfig
    const projectMode = (typedProject as unknown as { mode?: string }).mode ?? "support"

    // Build snapshot for AI package (no Clerk types)
    // Curated documentation links from "docs" content blocks - the bot can
    // point users to specific pages for more detail.
    const docLinks = (config.contentBlocks ?? [])
      .filter((bl) => bl.type === "docs")
      .flatMap((bl) => {
        const c = (bl.content && typeof bl.content === "object" ? bl.content : {}) as Record<string, string>
        return [1, 2, 3, 4, 5]
          .map((n) => ({ label: (c[`label${n}`] ?? "").trim(), url: (c[`url${n}`] ?? "").trim() }))
          .filter((p) => p.url)
          .map((p) => ({ label: p.label || p.url, url: p.url }))
      })
      .slice(0, 20)

    const configSnapshot: ProjectConfigSnapshot = {
      token: config.token
        ? {
            address: config.token.address,
            chain: config.token.chain,
            symbol: config.token.symbol,
            name: config.token.name,
            dexUrl: config.token.dexUrl,
          }
        : null,
      watchedContracts: (config.watchedContracts ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        chain: c.chain,
        description: c.description,
        ...(c.moduleName ? { moduleName: c.moduleName } : {}),
        // These were being dropped - without abi the contract-read tools are
        // never offered/usable, and without errorGlossary the team's custom
        // wording never reaches the prompt. Both are needed downstream.
        ...(c.errorGlossary ? { errorGlossary: c.errorGlossary } : {}),
        ...(c.abi ? { abi: c.abi } : {}),
        ...(c.abiSource ? { abiSource: c.abiSource } : {}),
      })),
      docsUrl: config.docsUrl,
      ...(config.audits && config.audits.length > 0
        ? { audits: config.audits.map(a => ({ auditor: a.auditor, url: a.url, date: a.date ?? null })) }
        : {}),
      ...(docLinks.length > 0 ? { docLinks } : {}),
    }

    // Inspect mode: scope the whole session to the pasted contract only. Its
    // scope guard then permits that contract (and blocks everything else), and
    // there are no docs to retrieve.
    if (inspectContracts) configSnapshot.watchedContracts = inspectContracts

    // RAG: only run for support mode (never for the docs-less inspect tool)
    let ragContext = ""
    // Kept so the answer can record what the documentation search returned.
    // Recorded even when nothing matched: "the docs did not cover this" is the
    // single most useful thing a protocol can learn from its own support log.
    let retrievalEvidence: AnswerEvidence["retrieval"]
    if (projectMode === "support" && !inspectMode) {
      const latestUserMessage = [...safeMessages].reverse().find((m) => m.role === "user")
      if (latestUserMessage) {
        const ragResult = await retrieveContext(supabase, typedProject.id, latestUserMessage.content)
        ragContext = ragResult.context
        const sources = Array.from(
          new Set(ragResult.chunks.map(c => c.source).filter((s): s is string => !!s)),
        ).slice(0, 8)
        const dropped = ragResult.chunks.length - ragResult.includedChunks
        retrievalEvidence = {
          matched: ragResult.chunks.length,
          ...(ragResult.chunks.length > 0
            ? { topScore: Math.round(Math.max(...ragResult.chunks.map(c => c.score)) * 1000) / 1000 }
            : {}),
          ...(dropped > 0 ? { dropped } : {}),
          ...(ragResult.contextChars > 0 ? { contextChars: ragResult.contextChars } : {}),
          ...(sources.length > 0 ? { sources } : {}),
        }
      }
    }

    // On-chain diagnosis. OFF (config.diagnostics === false) means this protocol
    // opted out of transaction/on-chain debugging: no wallet context, no
    // diagnostic tools (below), and a prompt that refuses. A wrong debug
    // suggestion is a risk some protocols will not carry.
    const diagnosticsOn = config.diagnostics !== false

    // Wallet config - passed to the AI so Claude can decide whether to use tools
    const walletConfig =
      projectMode === "support" && walletAddress && chainId && diagnosticsOn
        ? { address: walletAddress, chainId }
        : null

    // The protocol's own status notice, if their team has one up. Expiry is
    // resolved on read, so a lapsed notice stops appearing the moment it lapses.
    const statusNotice = activeStatusNotice(config)
    const betaProgramme = activeBeta(config)
    // Feedback and bug reporting are independent switches, so the prompt gets
    // told about each one separately rather than inferring one from the other.
    const { feedback: betaFeedback, bugs: betaBugs } = betaControls(betaProgramme)
    const betaControlsForPrompt = { feedback: betaFeedback, bugs: betaBugs }

    // The user's protocol account, resolved BEFORE the model sees the question.
    // Discovering a second address mid-conversation is how it ends up telling a
    // user their own address is not theirs. Cached for 5 minutes and shared
    // with the widget's connect-time lookup, so this is usually free.
    const protocolAccount = walletConfig
      ? await resolveProtocolAccount(rawConfig, walletConfig.address).catch(
          () => ({ status: "off" as const }),
        )
      : { status: "off" as const }

    // ── Actions policy gate → tools context ───────────────────────────────
    const gate = actionsGate(request, rawConfig, plan, isDemo, walletMode)
    const actionsCtx: ActionsContext | null =
      gate.allowed && walletConfig && chainId !== "solana" && chainId !== "aptos" && projectMode === "support" && !inspectMode
        ? {
            allowedFunctions: Object.fromEntries(
              Object.entries(rawConfig.actions?.allowedFunctions ?? {}).map(([cid, rules]) => [
                cid,
                rules.map(r => ({ fn: r.fn, ...(r.approval ? { approval: r.approval } : {}) })),
              ]),
            ),
            maxSwapUsd: effectiveMaxSwapUsd(rawConfig),
            projectToken: configSnapshot.token
              ? { address: configSnapshot.token.address, symbol: configSnapshot.token.symbol ?? "TOKEN", chain: configSnapshot.token.chain }
              : null,
            persistAction: async (record) => {
              await supabase.from("action_events").insert({
                project_id: typedProject.id,
                session_id: sessionId,
                action_id: record.id,
                kind: record.kind,
                chain: record.chainId,
                summary: record.summary,
                params: { ...record.params, _wallet: { address: walletConfig.address, chainId: walletConfig.chainId } },
                status: "prepared",
                country: gate.country,
              } as never)
            },
          }
        : null

    // Build system prompt. In demo-protocol mode the bot presents as the
    // protocol itself (e.g. "Uniswap Support") for a realistic try-it demo.
    const effectiveProjectName = demoProtocolId ? DEMO_PROTOCOLS[demoProtocolId].label : typedProject.name

    let systemPrompt = buildSystemPrompt({
      projectName: effectiveProjectName,
      config: configSnapshot,
      walletConfig,
      ragContext,
      // Docs are emitted separately, after the prompt-cache breakpoint: they
      // change with every question, so inline they would make the whole prefix
      // per-question and defeat caching entirely.
      docsSeparate: true,
      mode: projectMode as "support" | "token",
      tokenModeAsk: config.tokenModeAsk ?? undefined,
      persona: config.branding?.persona ?? "concise",
      ...(statusNotice
        ? { statusNotice: { level: statusNotice.level, message: statusNotice.message, ...(statusNotice.topics?.length ? { topics: statusNotice.topics } : {}) } }
        : {}),
      ...(protocolAccount.status !== "off" ? { protocolAccount } : {}),
      // Expiry resolved on read, so a finished beta stops changing the
      // assistant's behaviour the moment it ends.
      ...(betaProgramme ? { beta: betaControlsForPrompt } : {}),
      customTone: config.branding?.customTone ?? undefined,
      ...(config.branding?.language ? { language: config.branding.language } : {}),
      diagnostics: diagnosticsOn,
    })

    // Actions guardrails: execute-only, never solicit. The hard enforcement is
    // server-side (tools only exist when the gate passes); this aligns the
    // model's behaviour with it.
    if (actionsCtx) {
      systemPrompt +=
        `\n\n## Wallet actions\n` +
        `You can prepare transactions the user signs in their OWN wallet: swaps (prepare_swap) and enabled contract functions (prepare_contract_action). STRICT RULES:\n` +
        `- Only prepare an action the user EXPLICITLY asked to perform. NEVER propose, suggest, or recommend a trade, token, or action they did not ask for. No price predictions, no trading advice.\n` +
        `- Before calling a prepare tool, make sure the user's request specifies the essentials (what, how much). Ask for missing details instead of guessing.\n` +
        `- After preparing, briefly restate what will happen and tell the user to review and sign in their wallet. The card below your message handles the signing.\n` +
        `- If a prepare tool returns an error or refusal, relay it plainly and help diagnose. Never retry a refused action.\n` +
        `- You never send transactions, never hold funds, and TxID charges no fee on transactions.`
    }

    // After 4 user turns without resolution, force the AI to escalate
    const userTurnCount = messages.filter((m) => m.role === "user").length
    if (userTurnCount >= 4 && !validActionResult) {
      systemPrompt +=
        `\n\n⚠️ ESCALATION REQUIRED: This user has now sent ${userTurnCount} messages. ` +
        `Their issue is not yet resolved. You MUST call create_support_ticket in this response - ` +
        `do not attempt another resolution. Acknowledge what you've tried and hand off to the team.`
    }

    // Stream the response - Claude uses tools as needed for on-chain data
    const encoder = new TextEncoder()
    let streamCancelled = false
    const stream = new ReadableStream({
      async start(controller) {
        // A closed tab mid-answer used to throw out of enqueue, and the throw
        // skipped BOTH the transcript write and the token_usage row: the case
        // record lost the turn (against the product's core claim) and the
        // spend breaker undercounted exactly the connect-fire-disconnect
        // pattern an abuser would use. safeEnqueue swallows the cancellation
        // and lets the model loop RUN TO COMPLETION - deliberate: the cost is
        // already committed, and finishing means the answer, evidence and
        // usage all still land in the record.
        const safeEnqueue = (chunk: Uint8Array) => {
          if (streamCancelled) return
          try { controller.enqueue(chunk) } catch { streamCancelled = true }
        }

        let fullResponseText = ""
        let wasEscalated = false
        let usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string } | null = null
        const toolEvidence: ToolEvidence[] = []

        // Persistence for the WHOLE turn, called exactly once from `finally`
        // so it runs on the happy path, on an error, and on a disconnect
        // alike, with whatever partial state exists at that moment.
        const persistTurn = async () => {
          // Assemble the provenance list: what the tools touched, which
          // documentation pages backed it and at which version, and any hash
          // the USER supplied, kept distinct from ones we found.
          const merged = mergeToolEvidence(toolEvidence)
          const lastUser = [...safeMessages].reverse().find(m => m.role === "user")
          const provenance = [
            ...merged.sources,
            ...(await documentationSources(supabase, typedProject.id, retrievalEvidence?.sources ?? []).catch(() => [])),
            ...(lastUser ? userSuppliedHashes(lastUser.content, chainId ?? undefined) : []),
          ]

          // Which figures in the answer trace to nothing that was read. The
          // fatal failure for this product is a confident, specific, wrong
          // NUMBER about a user's own position, and that class is mechanically
          // checkable because every legitimate figure came from a tool result
          // or a documentation excerpt.
          const unverified = unverifiedNumbers(fullResponseText, merged.numbers, ragContext)

          const grounding: AnswerEvidence["grounding"] = merged.anyReadSucceeded
            ? "verified"
            : (retrievalEvidence?.matched ?? 0) > 0
              ? "documented"
              : "ungrounded"

          // The action-update marker is a system-generated status note, not a
          // user turn - persist it as an assistant-side row so it never counts
          // against the per-session user-message cap on subsequent requests.
          await persistMessages(supabase, typedProject.id, sessionId, validActionResult ? [...safeMessages, { role: "assistant" as const, content: `⚙️ Action update: ${validActionResult.row.summary ?? "transaction"} ${validActionResult.confirmed ? "confirmed" : "failed"} (${validActionResult.txHash})` }] : safeMessages, walletAddress, chainId, fullResponseText || undefined, usage, {
            ...requestEvidence,
            investigation: merged,
            ...(retrievalEvidence ? { retrieval: retrievalEvidence } : {}),
            ...(provenance.length ? { sources: provenance } : {}),
            ...(unverified.length ? { unverifiedNumbers: unverified } : {}),
            grounding,
            ...(chainId ? { chainId } : {}),
            surface: "widget",
            ...(config.branding?.language ? { language: config.branding.language } : {}),
          }, visitorId)
        }

        try {

          const streamMessages = validActionResult
            ? [
                ...safeMessages,
                {
                  role: "user" as const,
                  content:
                    `[Transaction update - system message, not typed by the user] ` +
                    `The prepared action "${validActionResult.row.summary ?? "transaction"}" was ${validActionResult.confirmed ? "CONFIRMED" : "FAILED"} on-chain. ` +
                    `Tx hash: ${validActionResult.txHash}.` +
                    (validActionResult.gasUsed ? ` Gas used: ${validActionResult.gasUsed}.` : "") +
                    (validActionResult.blockNumber ? ` Block: ${validActionResult.blockNumber}.` : "") +
                    (validActionResult.confirmed
                      ? " Briefly confirm completion to the user."
                      : " Diagnose why it failed (use get_transaction_by_hash with this hash; the receipt data above is ground truth if the indexer lags) and explain in plain English."),
                },
              ]
            : safeMessages

          for await (const event of streamChatWithTools(
            systemPrompt,
            streamMessages,
            walletConfig,
            configSnapshot.watchedContracts,
            800,
            actionsCtx,
            // Gate on MODE, not on whether retrieval returned anything. Support
            // mode still wants the block when nothing matched: its empty state
            // tells the model to fall back to general knowledge and point at the
            // team's docs. Token mode never retrieves at all, so it should not
            // gain a "no documentation matched" section it never had.
            projectMode === "support" ? buildDocsBlock(ragContext) : undefined,
            diagnosticsOn,
          )) {
            let data: string
            if (event.type === "tool_call") {
              data = `data: ${JSON.stringify({ tool_call: event.tool })}\n\n`
            } else if (event.type === "tool_evidence") {
              // Case-record only: never sent to the client, and never allowed
              // to interrupt the stream.
              toolEvidence.push(...event.items)
              continue
            } else if (event.type === "escalate") {
              wasEscalated = true
              data = `data: ${JSON.stringify({ escalate: { summary: event.summary, reason: event.reason } })}\n\n`
            } else if (event.type === "switch_chain") {
              data = `data: ${JSON.stringify({ switch_chain: { chainId: event.chainId, chainName: event.chainName } })}\n\n`
            } else if (event.type === "wallet_action") {
              data = `data: ${JSON.stringify({ wallet_action: event.action })}\n\n`
            } else if (event.type === "usage") {
              // Internal - captured for per-project cost accounting, not forwarded.
              usage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens, cacheReadTokens: event.cacheReadTokens, cacheWriteTokens: event.cacheWriteTokens, model: event.model }
              continue
            } else {
              fullResponseText += event.text
              data = `data: ${JSON.stringify({ text: event.text })}\n\n`
            }
            safeEnqueue(encoder.encode(data))
          }

          // Generate contextual follow-up chips after the main response.
          // Skipped when the team has curated its own chips: the widget would
          // ignore these anyway, so don't pay for the extra model call. Also
          // skipped when nobody is listening any more.
          const hasCuratedChips = (config.suggestedQuestions ?? []).some(q => q.trim().length > 0)
          // Not for diagnostics-off projects: the generated chips advertise
          // transaction diagnosis ("what caused this?", "how do I retry?"),
          // steering the user straight into what the bot must refuse.
          if (diagnosticsOn && !streamCancelled && !wasEscalated && !hasCuratedChips && fullResponseText.length > 20) {
            try {
              const items = await generateSuggestions(safeMessages, fullResponseText, ragContext)
              if (items.length > 0) {
                safeEnqueue(
                  encoder.encode(`data: ${JSON.stringify({ suggestions: { items } })}\n\n`),
                )
              }
            } catch {
              // non-fatal - chips are a nice-to-have
            }
          }

          safeEnqueue(encoder.encode("data: [DONE]\n\n"))

          // NO CAVEAT IS APPENDED TO THE ANSWER. Removed 2026-08-07.
          //
          // There used to be one, on two triggers: an ungrounded answer, and
          // any figure numeric-check could not trace. It misfired on correct
          // answers twice in one afternoon, once on a RECOMMENDED gas limit
          // (untraceable by definition, the user has not set it yet) and once
          // on a swap's output amount (no transaction-list endpoint returns
          // token amounts, so it is read from logs or derived, never quoted).
          // A warning that appears under correct answers reads as the product
          // doubting itself, and it teaches people to ignore warnings, which
          // costs exactly the one occasion it matters.
          //
          // NOTHING ABOUT THE DETECTION CHANGED. `grounding` and
          // `unverifiedNumbers` are still computed inside persistTurn and still
          // written to messages.evidence, still drive the `untraceable_figures`
          // and `ungrounded` ticket signals, the basis badge and the gaps view.
          // The team still sees every one of these; the end user no longer does.
          //
          // WHAT IT GIVES UP, PLAINLY: an ungrounded answer now looks
          // identical to a verified one to the person reading it. That was the
          // reason the caveat existed, and it is a real loss. Earning it back
          // needs claim-level provenance (roadmap a-audit-*) so the warning
          // attaches to the specific claim that lacks support, rather than a
          // blanket line under an answer that is mostly sourced.
        } catch (err) {
          log.error("Chat stream error", err, { event: "chat.stream_error", projectId: typedProject.id })
          // For our own demo/publicDemo projects, surface the real reason to make
          // the demo creator debuggable. Never leak internals to real customers.
          const detail = isDemo ? `: ${(err instanceof Error ? err.message : String(err)).slice(0, 300)}` : ""
          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ error: `Stream error${detail}` })}\n\n`),
          )
        } finally {
          // Persist on EVERY path - happy, errored, or disconnected - with
          // whatever partial state exists. Before this ran only on the happy
          // path, so a tab closed mid-answer erased the turn from the case
          // record and its usage row from the spend breaker.
          //
          // waitUntil, NOT void. A bare void meant the serverless function
          // could be FROZEN the instant the stream closed, so whether a
          // conversation was ever persisted was a race the platform usually
          // won: an empty Conversations tab after real conversations.
          // waitUntil keeps the function alive until the write completes
          // without delaying the stream's close by a millisecond.
          waitUntil(persistTurn().catch(err =>
            log.error("Chat persist failed", err, { event: "chat.persist_error", projectId: typedProject.id }),
          ))
          try { controller.close() } catch { /* already closed by cancellation */ }
        }
      },
      cancel() {
        // The client went away (tab close, navigation). Flag it so enqueues
        // become no-ops; the model loop finishes and persistTurn still records
        // the completed turn + usage.
        streamCancelled = true
      },
    })

    return new Response(stream, {
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (err) {
    log.error("Chat request failed", err, { event: "chat.request_error" })
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    })
  }
}

/** Request-side facts gathered before the answer, for the case record. */
interface EvidenceContext {
  chainId?: string
  geo?: { country?: string; region?: string }
  pageUrl?: string
  viewport?: string
  device?: ReturnType<typeof coarseDevice>
  surface?: string
  language?: string
  startedAt?: number
  investigation?: { toolsUsed: string[]; failedLookups: string[]; prices: Record<string, string> }
  retrieval?: AnswerEvidence["retrieval"]
  sources?: AnswerEvidence["sources"]
  grounding?: AnswerEvidence["grounding"]
}

async function persistMessages(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  sessionId: string,
  messages: ChatMessage[],
  walletAddress?: string,
  chainId?: string,
  assistantResponse?: string,
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string } | null,
  evidenceContext?: EvidenceContext,
  visitorId?: string,
) {
  try {
    const base = {
      project_id: projectId,
      session_id: sessionId,
      wallet_address: walletAddress ?? null,
      chain_id: chainId ?? null,
    }

    // DEPLOY-SAFE, and not theoretically. Production has repeatedly run code
    // ahead of its migrations, and the last time an unknown column reached this
    // upsert the row was never created, so NO CONVERSATION RECORDED AT ALL for
    // as long as it took to notice. A visitor id is a nice-to-have; the
    // transcript is the product. If the column is not there yet, drop it and
    // write the conversation anyway.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const upsertConv = (row: Record<string, unknown>) => (supabase as any)
      .from("conversations")
      .upsert(row, { onConflict: "project_id,session_id" })
      .select("id")
      .single()

    const first = visitorId
      ? await upsertConv({ ...base, visitor_id: visitorId })
      : await upsertConv(base)

    // Retry without the column if it is not there yet, never without the row.
    let conv = first.data
    if (first.error && visitorId) conv = (await upsertConv(base)).data

    if (!conv) return

    // EACH ROW CARRIES ITS OWN TIME. Both rows are written in one statement
    // after the answer has streamed, and Postgres `now()` is transaction-start
    // time, so relying on the column default stamped the question and the
    // answer with the SAME instant, to the second. Two consequences, both
    // visible in the transcript: every exchange looked instantaneous, and the
    // tie was broken by insertion order rather than by time, so an answer could
    // render above the question that prompted it.
    //
    // The user's row is stamped when their request ARRIVED, the assistant's
    // when the response finished, which is also the real latency they waited.
    const askedAt = new Date(evidenceContext?.startedAt ?? Date.now()).toISOString()
    const answeredAt = new Date().toISOString()

    const toInsert: {
      conversation_id: string
      role: "user" | "assistant"
      content: string
      created_at: string
      evidence?: AnswerEvidence
    }[] = []

    // Persist the turn-opening message: a real user turn on the normal path, or
    // an assistant-side action-update marker on the post-transaction follow-up.
    // (Prior history is already stored from earlier turns - only the latest.)
    const latest = messages[messages.length - 1]
    if (latest?.role === "user" || latest?.role === "assistant") {
      toInsert.push({ conversation_id: conv.id, role: latest.role, content: latest.content, created_at: askedAt })
    }
    if (assistantResponse) {
      // Evidence rides on the assistant row: it describes the conditions that
      // answer was produced under. Built after the response has already been
      // streamed, so the chain read costs the user no latency, and never
      // allowed to block the write.
      let evidence: AnswerEvidence | undefined
      try {
        evidence = {
          ...(evidenceContext?.chainId ? { chain: await chainStateAt(evidenceContext.chainId) } : {}),
          request: {
            ...(evidenceContext?.geo ?? {}),
            ...(evidenceContext?.device ?? {}),
            ...(evidenceContext?.surface ? { surface: evidenceContext.surface } : {}),
            ...(evidenceContext?.language ? { language: evidenceContext.language } : {}),
            ...(evidenceContext?.pageUrl ? { pageUrl: evidenceContext.pageUrl } : {}),
            ...(evidenceContext?.viewport ? { viewport: evidenceContext.viewport } : {}),
          },
          ...(usage?.model ? { model: { name: usage.model } } : {}),
          ...(evidenceContext?.retrieval ? { retrieval: evidenceContext.retrieval } : {}),
          ...(evidenceContext?.sources?.length ? { sources: evidenceContext.sources } : {}),
          ...(evidenceContext?.grounding ? { grounding: evidenceContext.grounding } : {}),
          ...(evidenceContext?.investigation
            ? {
                investigation: {
                  ...(evidenceContext.investigation.toolsUsed.length > 0
                    ? { toolsUsed: evidenceContext.investigation.toolsUsed }
                    : {}),
                  ...(evidenceContext.investigation.failedLookups.length > 0
                    ? { failedLookups: evidenceContext.investigation.failedLookups }
                    : {}),
                },
                // The prices an answer rested on: "you were down $312" is
                // unverifiable later without the price that produced it.
                ...(Object.keys(evidenceContext.investigation.prices).length > 0
                  ? { pricesAtRead: evidenceContext.investigation.prices }
                  : {}),
              }
            : {}),
          answer: answerFingerprint(assistantResponse),
          ...(evidenceContext?.startedAt ? { latencyMs: Date.now() - evidenceContext.startedAt } : {}),
        }
      } catch {
        evidence = undefined
      }
      toInsert.push({
        conversation_id: conv.id,
        role: "assistant",
        created_at: answeredAt,
        content: assistantResponse,
        ...(evidence ? { evidence } : {}),
      })
    }
    if (toInsert.length > 0) {
      await supabase.from("messages").insert(toInsert)
      // Stamp last_message_at so the conversation is flagged for (re-)summary.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id)
    }

    // Record token usage for the admin cost cockpit (denormalised project_id).
    if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0 || usage.cacheReadTokens > 0 || usage.cacheWriteTokens > 0)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      // Deploy-order safety. The cache columns arrive in a migration, and code
      // ships before migrations are applied. PostgREST rejects the WHOLE row if
      // a column is unknown, so writing them unconditionally means no usage is
      // recorded at all in that window: the cost cockpit goes blank and
      // daily_token_spend has nothing to count, which quietly disables the
      // spend circuit breaker. Write the full row, and on failure fall back to
      // the columns that have always existed.
      const base = {
        project_id: projectId,
        conversation_id: conv.id,
        model: usage.model,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: usageErr } = await (supabase as any).from("token_usage").insert({
        ...base,
        cache_read_tokens: usage.cacheReadTokens,
        cache_write_tokens: usage.cacheWriteTokens,
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (usageErr) await (supabase as any).from("token_usage").insert(base)
    }
  } catch (err) {
    // Non-fatal to the USER, whose answer already streamed. But never again
    // silent: this catch swallowed every persistence failure while the
    // production schema drifted, so conversations vanished for days with
    // nothing anywhere saying why. The conversation record is the product's
    // memory; losing it must at least leave a body.
    log.error("Conversation persist failed", err, {
      event: "chat.persist_failed",
      projectId,
      sessionId,
    })
  }
}
