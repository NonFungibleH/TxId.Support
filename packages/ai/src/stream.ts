import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type { ChatMessage, WatchedContractSnapshot } from "./types"
import { buildWalletTools, buildTxLookupTool, buildContractTxsTool, buildContractEventsTool, buildContractDeploymentTool, buildContractHoldingsTool, buildContractStateTool, buildEscalationTool, executeTool } from "./tools"
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
  | { type: "escalate"; summary: string; reason: string }
  // Emitted once at the very end with the total tokens spent on this turn
  // (summed across all tool-loop rounds). The API returns these for free in
  // each response; the caller persists them for per-project usage accounting.
  | { type: "usage"; inputTokens: number; outputTokens: number; model: string }

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
  maxTokens = 800,
): AsyncGenerator<StreamEvent> {
  const anthropic = getAnthropicClient()

  // ── Groq path with tool support ──────────────────────────────────────────
  if (!anthropic) {
    const client = getGroqClient()

    // Only offer blockchain tools when the latest message looks like a
    // transaction diagnostic query — not for general protocol/docs questions.
    const latestUserMsg = [...messages].reverse().find((m) => m.role === "user")?.content ?? ""
    const TX_KEYWORDS = /\b(fail|failed|error|stuck|pending|didn[‘’]t|did not|went wrong|lost|missing|not received|refund|my balance|what(‘s| is) my balance|my wallet|my tokens?|what do i have|my eth|my bnb|how much (do i|eth|bnb|have)|transaction (fail|stuck|didn)|tx |txn\b)/i
    const needsWalletTools = walletConfig !== null && TX_KEYWORDS.test(latestUserMsg)

    // Wallet tools only when connected + relevant; tx lookup, contract lookup, and escalation always available
    const contractTool = buildContractTxsTool(watchedContracts)
    const eventsTool = buildContractEventsTool(watchedContracts)
    const deploymentTool = buildContractDeploymentTool(watchedContracts)
    const holdingsTool = buildContractHoldingsTool(watchedContracts)
    const stateTool = buildContractStateTool(watchedContracts)
    const anthropicTools = [
      ...(needsWalletTools ? buildWalletTools(watchedContracts) : []),
      buildTxLookupTool(),
      ...(contractTool ? [contractTool] : []),
      ...(eventsTool ? [eventsTool] : []),
      ...(deploymentTool ? [deploymentTool] : []),
      ...(holdingsTool ? [holdingsTool] : []),
      ...(stateTool ? [stateTool] : []),
      buildEscalationTool(),
    ]
    const groqTools: OpenAI.ChatCompletionTool[] = anthropicTools.map((t) => ({
      type: "function" as const,
      function: {
        name: t.name,
        description: t.description ?? "",
        parameters: t.input_schema as Record<string, unknown>,
      },
    }))

    // Cap history to last 20 messages; cap each message to 2 000 chars
    const MAX_MSG = 20
    const MAX_CHARS = 2000
    const recentHistory = messages.slice(-MAX_MSG)

    let groqMessages: OpenAI.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      ...recentHistory.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, MAX_CHARS),
      })),
    ]

    const MAX_ROUNDS = 5
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (groqTools.length > 0) {
        // Non-streaming round so we can inspect tool_calls cleanly
        const response = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: maxTokens,
          messages: groqMessages,
          tools: groqTools,
          tool_choice: "auto",
          stream: false,
        })

        const msg = response.choices[0]?.message
        if (!msg) break

        type FnCall = { type: "function"; id: string; function: { name: string; arguments: string } }
        const fnCalls = (msg.tool_calls ?? []).filter((tc): tc is FnCall => tc.type === "function")
        if (fnCalls.length) {
          // Escalation is handled client-side — yield event and stop stream
          const escalationCall = fnCalls.find(tc => tc.function.name === "create_support_ticket")
          if (escalationCall) {
            const input = JSON.parse(escalationCall.function.arguments || "{}") as { summary?: string; reason?: string }
            yield { type: "escalate", summary: input.summary ?? "Issue needs further attention", reason: input.reason ?? "unresolved" }
            return
          }

          for (const tc of fnCalls) {
            yield { type: "tool_call", tool: tc.function.name }
          }

          groqMessages.push({ role: "assistant", content: msg.content ?? null, ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) })

          const toolResults = await Promise.all(
            fnCalls.map(async (tc) => {
              try {
                const input = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>
                const result = await executeTool(tc.function.name, input, walletConfig, watchedContracts)
                return { role: "tool" as const, tool_call_id: tc.id, content: JSON.stringify(result, null, 2) }
              } catch (err) {
                return { role: "tool" as const, tool_call_id: tc.id, content: `Error: ${err instanceof Error ? err.message : "Tool failed"}` }
              }
            }),
          )
          groqMessages.push(...toolResults)
          continue
        }

        // No tool calls — emit the text response
        if (msg.content) {
          yield { type: "text", text: msg.content }
          return
        }
        // Groq sometimes returns null content when tools are present but unused;
        // fall back to a plain streaming call without tools
        const fallbackStream = await client.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          max_tokens: maxTokens,
          messages: groqMessages,
          stream: true,
        })
        for await (const chunk of fallbackStream) {
          const text = chunk.choices[0]?.delta?.content
          if (text) yield { type: "text", text }
        }
        return
      }

      // No tools — stream directly
      const groqStream = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: maxTokens,
        messages: groqMessages,
        stream: true,
      })
      for await (const chunk of groqStream) {
        const text = chunk.choices[0]?.delta?.content
        if (text) yield { type: "text", text }
      }
      return
    }
    return
  }

  // ── Claude with agentic tool use ─────────────────────────────────────────
  const contractTool = buildContractTxsTool(watchedContracts)
  const eventsTool = buildContractEventsTool(watchedContracts)
  const deploymentTool = buildContractDeploymentTool(watchedContracts)
  const holdingsTool = buildContractHoldingsTool(watchedContracts)
  const stateTool = buildContractStateTool(watchedContracts)
  const tools = [
    ...(walletConfig ? buildWalletTools(watchedContracts) : []),
    buildTxLookupTool(),
    ...(contractTool ? [contractTool] : []),
    ...(eventsTool ? [eventsTool] : []),
    ...(deploymentTool ? [deploymentTool] : []),
    ...(holdingsTool ? [holdingsTool] : []),
    ...(stateTool ? [stateTool] : []),
    buildEscalationTool(),
  ]

  // Cap history to last 20 messages to prevent linear cost growth
  const recentMessages = messages.slice(-20)

  let currentMessages: Anthropic.MessageParam[] = recentMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }))

  const MODEL = "claude-haiku-4-5-20251001"
  const MAX_ROUNDS = 5
  let totalInputTokens = 0
  let totalOutputTokens = 0

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: currentMessages,
      ...(tools.length > 0 ? { tools } : {}),
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

    // Token usage for this round (the SDK accumulated the full message during
    // streaming, so finalMessage() is cheap). Summed across rounds = the real
    // tokens charged for this turn.
    const finalMsg = await stream.finalMessage()
    totalInputTokens += finalMsg.usage.input_tokens
    totalOutputTokens += finalMsg.usage.output_tokens

    // Claude gave a text response with no tool calls — done
    if (!hasToolCalls) break

    const toolUseBlocks = finalMsg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    )

    // Escalation is handled client-side — yield event and stop stream
    const escalationBlock = toolUseBlocks.find(b => b.name === "create_support_ticket")
    if (escalationBlock) {
      const input = escalationBlock.input as { summary?: string; reason?: string }
      yield { type: "escalate", summary: input.summary ?? "Issue needs further attention", reason: input.reason ?? "unresolved" }
      yield { type: "usage", inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model: MODEL }
      return
    }

    // Execute all wallet tool calls in parallel
    const toolResults = await Promise.all(
      toolUseBlocks.map(async (block) => {
        try {
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            walletConfig,
            watchedContracts,
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

  yield { type: "usage", inputTokens: totalInputTokens, outputTokens: totalOutputTokens, model: MODEL }
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
      model: "claude-haiku-4-5-20251001",
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
