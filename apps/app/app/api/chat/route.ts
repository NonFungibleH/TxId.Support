import { createServiceClient } from "@/lib/supabase/server"
import { buildSystemPrompt, retrieveContext, streamChatWithTools, generateSuggestions } from "@txid/ai"
import type { ChatMessage, ProjectConfigSnapshot } from "@txid/ai"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_CONV_LIMITS } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"
import { verifyPreviewToken } from "@/lib/preview-token"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

// ── Rate limiting (per-IP, in-memory) ────────────────────────────────────────
// 20 requests per IP per minute. In-memory is per-instance but sufficient to
// block rapid-fire abuse from a single client hitting the same Vercel instance.
const RATE_LIMIT = 20
const WINDOW_MS = 60_000

interface RateEntry { count: number; resetAt: number }
const rateLimitMap = new Map<string, RateEntry>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT) return true
  entry.count++
  return false
}

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
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      request.headers.get("x-real-ip") ??
      "unknown"

    if (isRateLimited(ip)) {
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
    }

    const { key, sessionId, messages, walletAddress, chainId, preview, previewToken, turnstileToken } = body

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

    // Cap message history to prevent context-stuffing / runaway LLM costs
    const MAX_MESSAGES = 30
    const MAX_CONTENT_LEN = 2000
    const safeMessages = messages
      .slice(-MAX_MESSAGES)
      .map(m => ({ ...m, content: typeof m.content === "string" ? m.content.slice(0, MAX_CONTENT_LEN) : m.content }))

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

    // ── Layer 3: Monthly conversation quota per project ───────────────────────
    // Quota is determined by the project's plan (free=50, starter=200, pro=2500, enterprise=∞).
    // Only applied to new sessions — existing sessions already counted when their first message
    // created the conversation row.
    const rawConfig = typedProject.config as unknown as ProjectConfig
    const monthlyLimit = PLAN_CONV_LIMITS[(rawConfig.plan ?? "free") as Plan]

    const existingConv = await supabase
      .from("conversations")
      .select("id")
      .eq("session_id", sessionId)
      .eq("project_id", typedProject.id)
      .maybeSingle()

    if (!existingConv.data) {
      // New session — check monthly count before allowing it to start
      const startOfMonth = new Date()
      startOfMonth.setUTCDate(1)
      startOfMonth.setUTCHours(0, 0, 0, 0)
      const { count: monthlyCount } = await supabase
        .from("conversations")
        .select("id", { count: "exact", head: true })
        .eq("project_id", typedProject.id)
        .gte("created_at", startOfMonth.toISOString())
      if (monthlyLimit !== Infinity && (monthlyCount ?? 0) >= monthlyLimit) {
        return new Response(JSON.stringify({ error: "Monthly conversation limit reached. Upgrade to continue." }), {
          status: 429,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
    }

    // ── Layer 1: Per-session message cap ──────────────────────────────────────
    // Prevents a single session from draining token budget. Stricter for the
    // public demo key (NEXT_PUBLIC_DEMO_WIDGET_KEY).
    const isDemoKey = key === process.env.DEMO_WIDGET_KEY
    const SESSION_MSG_LIMIT = isDemoKey ? 10 : 30

    if (existingConv.data) {
      const { count: msgCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", existingConv.data.id)
        .eq("role", "user")
      if ((msgCount ?? 0) >= SESSION_MSG_LIMIT) {
        return new Response(JSON.stringify({ error: "Session message limit reached. Start a new conversation to continue." }), {
          status: 429,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        })
      }
    }

    const config = typedProject.config as unknown as ProjectConfig
    const projectMode = (typedProject as unknown as { mode?: string }).mode ?? "support"

    // Build snapshot for AI package (no Clerk types)
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
      })),
      docsUrl: config.docsUrl,
    }

    // RAG: only run for support mode
    let ragContext = ""
    if (projectMode === "support") {
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

    // Build system prompt
    let systemPrompt = buildSystemPrompt({
      projectName: typedProject.name,
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
          void persistMessages(supabase, typedProject.id, sessionId, messages, walletAddress, chainId, fullResponseText || undefined)
        } catch (err) {
          console.error("[chat/stream]", err)
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
    console.error("[chat/POST]", err)
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
) {
  try {
    const { data: conv } = await supabase
      .from("conversations")
      .upsert(
        { project_id: projectId, session_id: sessionId, wallet_address: walletAddress ?? null, chain_id: chainId ?? null },
        { onConflict: "session_id" },
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
  } catch {
    // Non-fatal
  }
}
