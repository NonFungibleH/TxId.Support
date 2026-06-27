import { createServiceClient } from "@/lib/supabase/server"
import { buildSystemPrompt, retrieveContext, streamChatWithTools, generateSuggestions } from "@txid/ai"
import type { ChatMessage, ProjectConfigSnapshot } from "@txid/ai"
import type { ProjectConfig } from "@/lib/types/config"
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
    }

    const { key, sessionId, messages, walletAddress, chainId, preview, previewToken } = body

    if (!key || !sessionId || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    // F2: validate wallet address format before it touches any downstream URL
    if (walletAddress && !/^0x[0-9a-fA-F]{40}$/.test(walletAddress)) {
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
    const systemPrompt = buildSystemPrompt({
      projectName: typedProject.name,
      config: configSnapshot,
      walletConfig,
      ragContext,
      mode: projectMode as "support" | "token",
      tokenModeAsk: config.tokenModeAsk ?? undefined,
      persona: config.branding?.persona ?? "concise",
    })

    // Stream the response — Claude uses tools as needed for on-chain data
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let fullResponseText = ""
          let wasEscalated = false

          for await (const event of streamChatWithTools(
            systemPrompt,
            messages,
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
              const items = await generateSuggestions(messages, fullResponseText)
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
        } catch (err) {
          console.error("[chat/stream]", err)
          const msg = err instanceof Error ? err.message : "Stream error"
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          )
        } finally {
          controller.close()
        }
      },
    })

    // Persist conversation asynchronously (fire and forget)
    void persistMessages(supabase, typedProject.id, sessionId, messages, walletAddress, chainId)

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
    const msg = err instanceof Error ? err.message : "Internal error"
    return new Response(JSON.stringify({ error: msg }), {
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

    const latest = messages[messages.length - 1]
    if (latest?.role === "user") {
      await supabase
        .from("messages")
        .insert({ conversation_id: conv.id, role: "user", content: latest.content })
    }
  } catch {
    // Non-fatal
  }
}
