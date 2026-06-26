import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type { ChatMessage, WatchedContractSnapshot } from "./types"
import { buildWalletTools, executeTool } from "./tools"
import type { WalletConfig } from "./tools"

// ── Model selection ──────────────────────────────────────────────────────────
// Prefer Claude Haiku (tool use, better reasoning) when ANTHROPIC_API_KEY is
// available; fall back to Groq Llama 3.3 70B (free, no tool use).

let _anthropic: Anthropic | null = null
let _groq: OpenAI | null = null

function getAnthropicClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_anthropic) {
    _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return _anthropic
}

function getGroqClient(): OpenAI {
  if (!_groq) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error("No LLM API key configured (ANTHROPIC_API_KEY or GROQ_API_KEY)")
    _groq = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" })
  }
  return _groq
}

// ── Stream event types ───────────────────────────────────────────────────────

export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string }

// ── Agentic streaming with tool use ─────────────────────────────────────────

/**
 * Stream a chat response with optional blockchain tool use.
 *
 * When `walletConfig` is provided and Claude is available, the AI can call
 * tools (get_wallet_balance, get_recent_transactions, get_transaction_by_hash)
 * to look up live on-chain data. Claude decides what to fetch based on the
 * user's question — nothing is pre-fetched.
 *
 * When no wallet is connected, tools are omitted. Claude is instructed via
 * the system prompt to ask for the user's address if the question needs it.
 *
 * Yields: text chunks for streaming the response, and tool_call events so
 * the widget can show "Checking your transactions…" while Claude is working.
 */
export async function* streamChatWithTools(
  systemPrompt: string,
  messages: ChatMessage[],
  walletConfig: WalletConfig | null,
  watchedContracts: WatchedContractSnapshot[] = [],
  maxTokens = 2048,
): AsyncGenerator<StreamEvent> {
  const anthropic = getAnthropicClient()

  // ── Groq fallback — no tool support ─────────────────────────────────────
  if (!anthropic) {
    const client = getGroqClient()
    const groqStream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      ],
      stream: true,
    })
    for await (const chunk of groqStream) {
      const text = chunk.choices[0]?.delta?.content
      if (text) yield { type: "text", text }
    }
    return
  }

  // ── Claude with agentic tool use ─────────────────────────────────────────
  const tools = walletConfig ? buildWalletTools(watchedContracts) : []

  let currentMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }))

  const MAX_ROUNDS = 5

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = anthropic.messages.stream({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: currentMessages,
      tools: tools.length > 0 ? tools : undefined,
    })

    let hasToolCalls = false
    const emittedToolIds = new Set<string>()

    for await (const event of stream) {
      if (
        event.type === "content_block_start" &&
        event.content_block.type === "tool_use" &&
        !emittedToolIds.has(event.content_block.id)
      ) {
        emittedToolIds.add(event.content_block.id)
        hasToolCalls = true
        yield { type: "tool_call", tool: event.content_block.name }
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield { type: "text", text: event.delta.text }
      }
    }

    // Claude gave a text response with no tool calls — done
    if (!hasToolCalls) break

    // SDK accumulates the full message during streaming — get parsed tool inputs
    const finalMsg = await stream.finalMessage()

    const toolUseBlocks = finalMsg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    )

    // Execute all tool calls in parallel
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        try {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            walletConfig!,
          )
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result, null, 2),
          }
        } catch (err) {
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: `Error: ${err instanceof Error ? err.message : "Tool execution failed"}`,
            is_error: true,
          }
        }
      }),
    )

    // Append assistant + tool results and continue to next round
    currentMessages = [
      ...currentMessages,
      { role: "assistant", content: finalMsg.content },
      { role: "user", content: toolResults },
    ]
  }
}

// ── Text-only helpers ────────────────────────────────────────────────────────

/**
 * Simple text-only stream with no tool use. Used by completeChat.
 */
export async function* streamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 2048,
): AsyncGenerator<string> {
  const anthropic = getAnthropicClient()

  if (anthropic) {
    const stream = anthropic.messages.stream({
      model: "claude-3-5-haiku-20241022",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text
      }
    }
  } else {
    const client = getGroqClient()
    const groqStream = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      stream: true,
    })
    for await (const chunk of groqStream) {
      const text = chunk.choices[0]?.delta?.content
      if (text) yield text
    }
  }
}

/**
 * Collect the full streamed response into a single string (non-streaming).
 */
export async function completeChat(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 2048,
): Promise<string> {
  let result = ""
  for await (const chunk of streamChat(systemPrompt, messages, maxTokens)) {
    result += chunk
  }
  return result
}
