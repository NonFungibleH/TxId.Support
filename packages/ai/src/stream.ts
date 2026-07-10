import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type { ChatMessage, WatchedContractSnapshot } from "./types"
import { buildWalletTools, buildTxLookupTool, buildContractTxsTool, buildContractEventsTool, buildContractDeploymentTool, buildContractHoldingsTool, buildContractStateTool, buildContractDataTool, buildContractInfoTool, buildContractFunctionsTool, buildUpgradeHistoryTool, buildTokenTools, buildNetworkTool, buildNativePriceTool, buildSanctionsTool, buildTokenSafetyTool, buildEnsTool, buildEstimateActionTool, buildEscalationTool, executeTool } from "./tools"
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

// Hard ceiling on any single tool execution, so one hung RPC/API call can't
// stall the whole stream (the widget would otherwise spin forever). Individual
// fetches have their own shorter timeouts; this is the backstop.
const TOOL_TIMEOUT_MS = 25_000

async function executeToolWithTimeout(
  name: string,
  input: Record<string, unknown>,
  wallet: WalletConfig | null,
  watchedContracts: WatchedContractSnapshot[],
): Promise<unknown> {
  return Promise.race([
    executeTool(name, input, wallet, watchedContracts),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timed out — the data source is slow or unreachable right now`)), TOOL_TIMEOUT_MS),
    ),
  ])
}

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

    // Offer wallet tools whenever a wallet is connected — same rule as the
    // Claude path. (A previous keyword-regex gate produced false negatives:
    // "is my withdrawal complete?" wouldn't match, so a connected wallet
    // couldn't be used. The prompt handles when NOT to call them.)
    const needsWalletTools = walletConfig !== null

    // Wallet tools only when connected; tx lookup, contract tools, and escalation always available
    const contractToolset = [
      buildContractTxsTool, buildContractEventsTool, buildContractDeploymentTool,
      buildContractHoldingsTool, buildContractStateTool, buildContractDataTool,
      buildContractInfoTool, buildContractFunctionsTool, buildUpgradeHistoryTool,
    ].map(b => b(watchedContracts)).filter((t): t is NonNullable<typeof t> => t !== null)
    const anthropicTools = [
      ...(needsWalletTools ? buildWalletTools(watchedContracts) : []),
      buildTxLookupTool(),
      ...contractToolset,
      ...buildTokenTools(),
      buildNetworkTool(),
      buildNativePriceTool(),
      buildSanctionsTool(),
      buildTokenSafetyTool(),
      buildEnsTool(),
      ...(walletConfig ? [buildEstimateActionTool(watchedContracts)].filter((t): t is NonNullable<typeof t> => t !== null) : []),
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
            let input: { summary?: string; reason?: string } = {}
            try {
              input = JSON.parse(escalationCall.function.arguments || "{}") as { summary?: string; reason?: string }
            } catch { /* malformed args from the model — escalate with defaults */ }
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
                const result = await executeToolWithTimeout(tc.function.name, input, walletConfig, watchedContracts)
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

    // Exhausted MAX_ROUNDS without a text answer — force one final no-tools
    // completion so the user never gets a blank response.
    const closing = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      messages: [...groqMessages, { role: "user", content: "Give your best final answer now in plain English using what you found above. Do not call any more tools." }],
      stream: true,
    })
    let emittedClosing = false
    for await (const chunk of closing) {
      const text = chunk.choices[0]?.delta?.content
      if (text) { emittedClosing = true; yield { type: "text", text } }
    }
    if (!emittedClosing) {
      yield { type: "text", text: "I looked into that but couldn't complete the diagnosis in one go. Could you rephrase, or share the specific transaction hash so I can dig in directly?" }
    }
    return
  }

  // ── Claude with agentic tool use ─────────────────────────────────────────
  const contractToolset = [
    buildContractTxsTool, buildContractEventsTool, buildContractDeploymentTool,
    buildContractHoldingsTool, buildContractStateTool, buildContractDataTool,
    buildContractInfoTool, buildContractFunctionsTool, buildUpgradeHistoryTool,
  ].map(b => b(watchedContracts)).filter((t): t is NonNullable<typeof t> => t !== null)
  const tools = [
    ...(walletConfig ? buildWalletTools(watchedContracts) : []),
    buildTxLookupTool(),
    ...contractToolset,
    ...buildTokenTools(),
    buildNetworkTool(),
    buildNativePriceTool(),
    buildSanctionsTool(),
    buildTokenSafetyTool(),
    buildEnsTool(),
    ...(walletConfig ? [buildEstimateActionTool(watchedContracts)].filter((t): t is NonNullable<typeof t> => t !== null) : []),
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
  let endedWithText = false
  let anyTextThisTurn = false

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
        anyTextThisTurn = true
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
    if (!hasToolCalls) { endedWithText = true; break }

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
          const result = await executeToolWithTimeout(
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

  // Exhausted MAX_ROUNDS still calling tools, and never produced a final
  // answer → the user would otherwise get a blank bubble. Do ONE final
  // completion with tools disabled to force a text summary of what was found.
  if (!endedWithText && !anyTextThisTurn) {
    try {
      const closing = anthropic.messages.stream({
        model: MODEL,
        max_tokens: maxTokens,
        system: systemPrompt + "\n\nYou have gathered tool results above. Give the user your best final answer now in plain English, using what you found. Do not call any more tools.",
        messages: currentMessages,
      })
      for await (const event of closing) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          anyTextThisTurn = true
          yield { type: "text", text: event.delta.text }
        }
      }
      const fm = await closing.finalMessage()
      totalInputTokens += fm.usage.input_tokens
      totalOutputTokens += fm.usage.output_tokens
    } catch { /* fall through to the guaranteed fallback below */ }
  }

  // Absolute backstop: never end a turn with zero text.
  if (!anyTextThisTurn) {
    yield { type: "text", text: "I looked into that but couldn't complete the diagnosis in one go. Could you rephrase, or share the specific transaction hash so I can dig in directly?" }
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
