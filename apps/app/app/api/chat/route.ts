import { createServiceClient } from "@/lib/supabase/server"
import { buildSystemPrompt, retrieveContext, streamChatWithTools, generateSuggestions } from "@txid/ai"
import type { ChatMessage, ProjectConfigSnapshot } from "@txid/ai"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"
import { verifyPreviewToken } from "@/lib/preview-token"
import { rateLimit } from "@/lib/rate-limit"
import { log } from "@/lib/logger"
import { CHAT_LIMITS, conversationLimitsFor } from "@/lib/limits"
import { fetchAbiWithProxy, fetchAbiFromExplorer } from "@txid/blockchain"
import { demoContractsFor, demoContractDescription, DEMO_PROTOCOLS } from "@/lib/demo-protocols"

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

const EXEMPT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function extractHostname(originOrReferer: string): string | null {
  try {
    return new URL(originOrReferer).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Domain allowlist enforcement — mirrors /api/widget-config so the expensive
 * chat endpoint is gated the same way the config endpoint is. Without this a
 * copied publishable key lets any browser origin burn a project's conversation
 * quota + LLM spend. Empty allowedDomains = not yet restricted (open); once the
 * protocol adds at least one domain, only those origins may call chat. Preview
 * requests are exempt (they carry a server-signed token, checked separately).
 */
function originAllowed(
  request: Request,
  allowedDomains: string[] | undefined,
  preview: boolean,
): boolean {
  if (preview) return true
  const originHeader = request.headers.get("origin") ?? request.headers.get("referer")
  const requestHost = originHeader ? extractHostname(originHeader) : null
  if (!requestHost || EXEMPT_HOSTS.has(requestHost)) return true
  const allowed = allowedDomains ?? []
  if (allowed.length === 0) return true
  const normalised = allowed.map((d) => d.replace(/^https?:\/\//, "").toLowerCase())
  return normalised.includes(requestHost)
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    const { allowed } = await rateLimit(`chat:${ip}`, CHAT_LIMITS.ratePerWindow, CHAT_LIMITS.windowMs)
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
    }

    const { key, sessionId, messages, walletAddress, chainId, preview, previewToken, turnstileToken, contractAddress, demoProtocol } = body

    if (!key || !sessionId || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // ── Layer 2: Turnstile bot validation (when token provided by client) ──────
    // Only enforced when TURNSTILE_SECRET_KEY is configured. Requests without a
    // token are allowed through so embedded protocol widgets aren't affected.
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
    // depends on this being our demo project — recognised by the demo key OR the
    // "demo" plan, so it works even when the demo key env var isn't mirrored onto
    // this deployment. Declarations kept here so they stay in scope downstream.
    const inspectAddress = typeof contractAddress === "string" ? contractAddress.trim() : ""
    const demoProtocolId = typeof demoProtocol === "string" && DEMO_PROTOCOLS[demoProtocol] ? demoProtocol : ""
    let inspectContracts: ProjectConfigSnapshot["watchedContracts"] | null = null
    let inspectMode = false

    // Cap message history to prevent context-stuffing / runaway LLM costs
    const safeMessages = messages
      .slice(-CHAT_LIMITS.maxHistoryMessages)
      .map(m => ({ ...m, content: typeof m.content === "string" ? m.content.slice(0, CHAT_LIMITS.maxMessageChars) : m.content }))

    // F2: validate wallet address format before it touches any downstream URL
    // Accepts EVM (0x + 40 hex) or Solana (base58, 32-44 chars)
    const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/
    const SOL_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
    if (walletAddress && !EVM_ADDR.test(walletAddress) && !SOL_ADDR.test(walletAddress)) {
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

    // F1: preview mode requires a server-signed token — prevents unauthenticated quota abuse
    if (!typedProject.is_active) {
      if (!preview || !verifyPreviewToken(typedProject.id, previewToken)) {
        return new Response(JSON.stringify({ error: "Project is inactive" }), {
          status: 403,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
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

    // Our own demo project, recognised three ways: the demo key (when its env
    // var is set on this deployment), the "demo" plan, or the publicDemo flag on
    // the project row. The flag lets our demo project stay on "custom" (needed
    // for the marketing-site widget + admin) while still powering /check — set it
    // in /admin. This means /check works without mirroring the demo key env var
    // from the marketing site onto this API deployment.
    const isDemo = isDemoKey(key) || plan === "demo" || rawConfig.publicDemo === true

    // Domain allowlist — reject before claiming a conversation slot or calling
    // the LLM, so a copied key from a non-registered origin can't drain quota.
    // Exempt OUR own demo project: it powers the /demo + /check pages on the
    // marketing site (any origin by design) and is protected by the per-IP rate
    // cap + Turnstile, not the per-customer domain allowlist.
    if (!isDemo && !originAllowed(request, rawConfig.allowedDomains, preview === true)) {
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
    inspectMode = isDemo && (!!demoProtocolId || /^0x[0-9a-fA-F]{40}$/.test(inspectAddress))
    if (inspectMode) {
      // Require a bot-check token when Turnstile is configured.
      if (process.env.TURNSTILE_SECRET_KEY && !turnstileToken) {
        return new Response(JSON.stringify({ error: "Please complete the bot check to run a diagnosis." }), {
          status: 403, headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
      // Hard cap: 3 messages per IP per 24h. Server-enforced (a refresh, a new
      // session, or switching demo protocol can't reset it) so the public demo
      // can never run up our LLM/RPC cost.
      const daily = await rateLimit(`inspect:${ip}`, 3, 86_400_000)
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
      // Existing session — enforce the per-session message cap (stricter for
      // the public demo key).
      const sessionCap = isDemo ? CHAT_LIMITS.demoSessionMessages : CHAT_LIMITS.sessionMessages
      const { count: msgCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", existingConv.data.id)
        .eq("role", "user")
      if ((msgCount ?? 0) >= sessionCap) {
        // Cap reached — don't cold-error the user out. Escalate to a human:
        // emit the same SSE `escalate` event the AI uses, which the widget
        // renders as its ticket form and ends the conversation gracefully.
        const enc = new TextEncoder()
        const capStream = new ReadableStream({
          start(controller) {
            controller.enqueue(
              enc.encode(
                `data: ${JSON.stringify({
                  text: "We've covered a lot in this chat. So nothing gets lost, I'll hand you over to the team — drop your details below and someone will follow up with you directly.",
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
        return new Response(capStream, {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        })
      }
    } else if (preview) {
      // Preview sessions (dashboard testing) are recorded so the user can see
      // Conversations/Analytics working, but they never count toward the paid
      // conversation quota. persistMessages will create the conversation row.
    } else {
      // New session — atomically claim a slot against the monthly + daily caps.
      const { monthly, daily } = conversationLimitsFor(plan)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: slot } = await (supabase as any).rpc("claim_conversation_slot", {
        p_project_id: typedProject.id,
        p_session_id: sessionId,
        p_monthly_limit: monthly === Infinity ? -1 : monthly,
        p_daily_limit: daily === Infinity ? -1 : daily,
      })
      if (slot === "month_limit") {
        return new Response(JSON.stringify({ error: "Monthly conversation limit reached. Contact us to upgrade." }), {
          status: 429,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
      if (slot === "day_limit") {
        return new Response(JSON.stringify({ error: "Daily conversation limit reached. Please try again tomorrow." }), {
          status: 429,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
    }

    const config = typedProject.config as unknown as ProjectConfig
    const projectMode = (typedProject as unknown as { mode?: string }).mode ?? "support"

    // Build snapshot for AI package (no Clerk types)
    // Curated documentation links from "docs" content blocks — the bot can
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
        // These were being dropped — without abi the contract-read tools are
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
    if (projectMode === "support" && !inspectMode) {
      const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")
      if (latestUserMessage) {
        const ragResult = await retrieveContext(supabase, typedProject.id, latestUserMessage.content)
        ragContext = ragResult.context
      }
    }

    // Wallet config — passed to the AI so Claude can decide whether to use tools
    const walletConfig =
      projectMode === "support" && walletAddress && chainId
        ? { address: walletAddress, chainId }
        : null

    // Build system prompt. In demo-protocol mode the bot presents as the
    // protocol itself (e.g. "Uniswap Support") for a realistic try-it demo.
    const effectiveProjectName = demoProtocolId ? DEMO_PROTOCOLS[demoProtocolId].label : typedProject.name

    let systemPrompt = buildSystemPrompt({
      projectName: effectiveProjectName,
      config: configSnapshot,
      walletConfig,
      ragContext,
      mode: projectMode as "support" | "token",
      tokenModeAsk: config.tokenModeAsk ?? undefined,
      persona: config.branding?.persona ?? "concise",
      ...(config.branding?.language ? { language: config.branding.language } : {}),
    })

    // After 4 user turns without resolution, force the AI to escalate
    const userTurnCount = messages.filter((m) => m.role === "user").length
    if (userTurnCount >= 4) {
      systemPrompt +=
        `\n\n⚠️ ESCALATION REQUIRED: This user has now sent ${userTurnCount} messages. ` +
        `Their issue is not yet resolved. You MUST call create_support_ticket in this response — ` +
        `do not attempt another resolution. Acknowledge what you've tried and hand off to the team.`
    }

    // Stream the response — Claude uses tools as needed for on-chain data
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponseText = ""
          let wasEscalated = false
          let usage: { inputTokens: number; outputTokens: number; model: string } | null = null

          for await (const event of streamChatWithTools(
            systemPrompt,
            safeMessages,
            walletConfig,
            configSnapshot.watchedContracts,
          )) {
            let data: string
            if (event.type === "tool_call") {
              data = `data: ${JSON.stringify({ tool_call: event.tool })}\n\n`
            } else if (event.type === "escalate") {
              wasEscalated = true
              data = `data: ${JSON.stringify({ escalate: { summary: event.summary, reason: event.reason } })}\n\n`
            } else if (event.type === "switch_chain") {
              data = `data: ${JSON.stringify({ switch_chain: { chainId: event.chainId, chainName: event.chainName } })}\n\n`
            } else if (event.type === "usage") {
              // Internal — captured for per-project cost accounting, not forwarded.
              usage = { inputTokens: event.inputTokens, outputTokens: event.outputTokens, model: event.model }
              continue
            } else {
              fullResponseText += event.text
              data = `data: ${JSON.stringify({ text: event.text })}\n\n`
            }
            controller.enqueue(encoder.encode(data))
          }

          // Generate contextual follow-up chips after the main response
          if (!wasEscalated && fullResponseText.length > 20) {
            try {
              const items = await generateSuggestions(safeMessages, fullResponseText)
              if (items.length > 0) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ suggestions: { items } })}\n\n`),
                )
              }
            } catch {
              // non-fatal — chips are a nice-to-have
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"))

          // Persist user message + assistant response after stream completes
          void persistMessages(supabase, typedProject.id, sessionId, messages, walletAddress, chainId, fullResponseText || undefined, usage)
        } catch (err) {
          log.error("Chat stream error", err, { event: "chat.stream_error", projectId: typedProject.id })
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "Stream error" })}\n\n`),
          )
        } finally {
          controller.close()
        }
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

async function persistMessages(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  sessionId: string,
  messages: ChatMessage[],
  walletAddress?: string,
  chainId?: string,
  assistantResponse?: string,
  usage?: { inputTokens: number; outputTokens: number; model: string } | null,
) {
  try {
    const { data: conv } = await supabase
      .from("conversations")
      .upsert(
        { project_id: projectId, session_id: sessionId, wallet_address: walletAddress ?? null, chain_id: chainId ?? null },
        { onConflict: "project_id,session_id" },
      )
      .select("id")
      .single()

    if (!conv) return

    const toInsert: { conversation_id: string; role: "user" | "assistant"; content: string }[] = []

    const latest = messages[messages.length - 1]
    if (latest?.role === "user") {
      toInsert.push({ conversation_id: conv.id, role: "user", content: latest.content })
    }
    if (assistantResponse) {
      toInsert.push({ conversation_id: conv.id, role: "assistant", content: assistantResponse })
    }
    if (toInsert.length > 0) {
      await supabase.from("messages").insert(toInsert)
    }

    // Record token usage for the admin cost cockpit (denormalised project_id).
    if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).from("token_usage").insert({
        project_id: projectId,
        conversation_id: conv.id,
        model: usage.model,
        input_tokens: usage.inputTokens,
        output_tokens: usage.outputTokens,
      })
    }
  } catch {
    // Non-fatal
  }
}
