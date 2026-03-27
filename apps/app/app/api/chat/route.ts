import { createServiceClient } from "@/lib/supabase/server"
import { buildSystemPrompt, retrieveContext, streamChat } from "@txid/ai"
import type { ChatMessage, ProjectConfigSnapshot } from "@txid/ai"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

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
  try {
    const body = (await request.json()) as {
      key: string
      sessionId: string
      messages: ChatMessage[]
      walletAddress?: string
      chainId?: string
    }

    const { key, sessionId, messages, walletAddress, chainId } = body

    if (!key || !sessionId || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
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

    if (!typedProject.is_active) {
      return new Response(JSON.stringify({ error: "Project is inactive" }), {
        status: 403,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      })
    }

    const config = typedProject.config as unknown as ProjectConfig

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

    const projectMode = (typedProject as unknown as { mode?: string }).mode ?? "support"

    // RAG: only run for support mode
    let ragContext = ""
    if (projectMode === "support") {
      const latestUserMessage = [...messages].reverse().find((m) => m.role === "user")
      if (latestUserMessage) {
        const ragResult = await retrieveContext(supabase, typedProject.id, latestUserMessage.content)
        ragContext = ragResult.context
      }
    }

    // Build system prompt — mode-aware
    const systemPrompt = buildSystemPrompt({
      projectName: typedProject.name,
      config: configSnapshot,
      messages,
      walletAddress: projectMode === "support" ? walletAddress : undefined,
      chainId: projectMode === "support" ? chainId : undefined,
      ragContext,
      mode: projectMode as "support" | "token",
      tokenModeAsk: config.tokenModeAsk ?? undefined,
    })

    // Stream the response using Server-Sent Events
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamChat(systemPrompt, messages)) {
            const data = `data: ${JSON.stringify({ text: chunk })}\n\n`
            controller.enqueue(encoder.encode(data))
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream error"
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`),
          )
        } finally {
          controller.close()
        }
      },
    })

    // Persist conversation + messages asynchronously (fire and forget)
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
    // Upsert conversation by sessionId
    const { data: conv } = await supabase
      .from("conversations")
      .upsert(
        { project_id: projectId, session_id: sessionId, wallet_address: walletAddress ?? null, chain_id: chainId ?? null },
        { onConflict: "session_id" },
      )
      .select("id")
      .single()

    if (!conv) return

    // Only insert the latest user message (assistant response is streamed — saved on next turn)
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
