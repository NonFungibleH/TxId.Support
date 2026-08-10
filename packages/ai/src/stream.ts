import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type { ChatMessage, WatchedContractSnapshot } from "./types"
import { toolEvidenceFrom, type ToolEvidence } from "./evidence"
import { buildWalletTools, buildTxLookupTool, buildContractTxsTool, buildContractEventsTool, buildContractDeploymentTool, buildContractHoldingsTool, buildContractStateTool, buildContractDataTool, buildContractInfoTool, buildContractFunctionsTool, buildUpgradeHistoryTool, buildTokenTools, buildNetworkTool, buildWalletDiagnosisTool, buildNativePriceTool, buildSanctionsTool, buildTokenSafetyTool, buildEnsTool, buildEstimateActionTool, buildEscalationTool, executeTool } from "./tools"
import type { WalletConfig } from "./tools"
import { buildPrepareContractActionTool, buildPrepareSwapTool, executeActionTool } from "./actions"
import type { ActionsContext, ActionPayload } from "./actions"

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

/**
 * How much text to hold back before deciding it is an answer, not narration.
 * Pre-tool narration is a sentence or two ("Let me list the functions."), so
 * anything longer is real content and should stream rather than wait.
 */
const NARRATION_CHARS = 80

/**
 * How long text may be held back before it streams regardless.
 *
 * The character cap alone made every answer under 200 characters appear as a
 * dead pause followed by the whole thing at once, which reads as hesitation
 * even when the total time is unchanged. Narration ("Let me check that.")
 * arrives in a few hundred milliseconds and is followed almost immediately by
 * the tool call that proves what it was, so a window this long still catches
 * it, while a real answer starts moving when the user expects it to.
 */
const NARRATION_HOLD_MS = 700

/** Keep a paragraph break between text from separate tool-loop rounds. */
function separate(text: string, alreadyEmitted: boolean): string {
  return alreadyEmitted ? `\n\n${text.replace(/^\s+/, "")}` : text
}

export type StreamEvent =
  // Compact facts about what the investigation actually read: which tools ran,
  // which lookups failed, and the prices the answer rested on. Consumed by the
  // case record, never shown to the user.
  | { type: "tool_evidence"; items: ToolEvidence[] }
  | { type: "text"; text: string }
  | { type: "tool_call"; tool: string }
  | { type: "escalate"; summary: string; reason: string }
  // Emitted when diagnose_wallet finds the wallet on the wrong network and the
  // protocol lives on a single known EVM chain — the widget renders a one-tap
  // "Switch to <chainName>" button.
  | { type: "switch_chain"; chainId: string; chainName: string }
  // Emitted once at the very end with the total tokens spent on this turn
  // (summed across all tool-loop rounds). The API returns these for free in
  // each response; the caller persists them for per-project usage accounting.
  | { type: "usage"; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string }
  // Emitted when a prepare_* action tool built an unsigned transaction — the
  // widget renders a "Review in wallet" card. The user signs in their own
  // wallet; nothing executes server-side.
  | { type: "wallet_action"; action: ActionPayload }

/**
 * Extract client-side action events from executed tool results. Currently the
 * only one: diagnose_wallet may attach a `switchTo` target when the wallet is
 * on the wrong network, which becomes a "Switch to X" button in the widget.
 */
function clientActionsFrom(executed: Array<{ name: string; result: unknown }>): StreamEvent[] {
  const events: StreamEvent[] = []
  for (const { name, result } of executed) {
    if (!result || typeof result !== "object") continue
    if (name === "diagnose_wallet") {
      const s = (result as { switchTo?: { chainId?: string; chainName?: string } }).switchTo
      if (s?.chainId && s?.chainName) events.push({ type: "switch_chain", chainId: s.chainId, chainName: s.chainName })
    }
    if (name === "prepare_swap" || name === "prepare_contract_action") {
      const a = (result as { clientAction?: ActionPayload }).clientAction
      if (a?.id) events.push({ type: "wallet_action", action: a })
    }
  }
  return events
}

// The clientAction payload (raw calldata) is for the widget, not the model —
// strip it from tool_result content so it doesn't burn context tokens.
function stripClientAction(result: unknown): unknown {
  if (result && typeof result === "object" && "clientAction" in result) {
    const { clientAction: _omit, ...rest } = result as Record<string, unknown>
    return rest
  }
  return result
}

// Hard ceiling on any single tool execution, so one hung RPC/API call can't
// stall the whole stream (the widget would otherwise spin forever). Individual
// fetches have their own shorter timeouts; this is the backstop.
const TOOL_TIMEOUT_MS = 25_000

async function executeToolWithTimeout(
  name: string,
  input: Record<string, unknown>,
  wallet: WalletConfig | null,
  watchedContracts: WatchedContractSnapshot[],
  actions: ActionsContext | null,
): Promise<unknown> {
  const run =
    (name === "prepare_swap" || name === "prepare_contract_action") && wallet && actions
      ? executeActionTool(name, input, wallet, watchedContracts, actions)
      : executeTool(name, input, wallet, watchedContracts)
  return Promise.race([
    run,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${name} timed out, the data source is slow or unreachable right now`)), TOOL_TIMEOUT_MS),
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
/**
 * The system prompt plus tool schemas is ~9k tokens once the per-question docs
 * are excluded, and is then byte-identical across every question and every user
 * of a project - not merely within one conversation. It was being resent at
 * full input price on each of up to MAX_ROUNDS rounds per user message. Marking
 * it as a cache breakpoint bills a write at 1.25x and every later read at 0.1x.
 *
 * Keeping the retrieved docs OUT of this block is what makes it work at all:
 * inline, they change with every question, so each message would rewrite the
 * prefix instead of reading it - and a one-call question would pay the write
 * premium and never read, costing MORE than no caching.
 *
 * Placement: tools render before system, so one breakpoint on the last system
 * block covers BOTH. The prefix must stay byte-stable to hit - anything
 * per-request (a timestamp, the user's question) belongs in messages, never
 * here. Haiku 4.5's minimum cacheable prefix is 4096 tokens; ours clears it
 * comfortably, and a shorter prompt simply misses rather than erroring.
 */
function cachedSystem(prompt: string, docs?: string): Anthropic.TextBlockParam[] {
  return [
    /**
     * Default 5-minute TTL rather than the 1h option. Now that the retrieved
     * docs sit outside this block, the prefix is identical for every question
     * AND every user of a project, so it is kept alive by the project's traffic
     * rather than by one conversation's pace. The 1h write costs 2x base input
     * against 1.25x, which only pays off once a project sustains roughly 1.6
     * conversations per hour - above that, one hourly write serves everything;
     * below it, the pricier write is charged nearly per conversation anyway.
     * Trial-level traffic sits near that line, so take the cheaper write. Flip
     * to `ttl: "1h"` once a project is reliably busier than that.
     */
    { type: "text", text: prompt, cache_control: { type: "ephemeral" } },
    // AFTER the breakpoint on purpose. The prompt needs the wall clock to
    // answer "how long until the unlock", but a second-resolution timestamp
    // inside the cached block would change its bytes on every call: the prefix
    // would never match, and every request would pay the 1.25x write premium
    // with no read ever. Trailing blocks don't affect the prefix hash.
    { type: "text", text: `Current date/time: ${new Date().toUTCString()}.` },
    // Also after the breakpoint: the retrieved documentation for THIS question.
    ...(docs ? [{ type: "text" as const, text: docs }] : []),
  ]
}

/**
 * Strip em dashes from anything the model says, deterministically.
 *
 * The rule is in the system prompt and the model mostly follows it, but
 * "mostly" is not a house style. An end-user test caught one in a live answer,
 * and a prompt instruction cannot be the only guarantee for something that
 * appears in front of every customer's users. Replaced with a comma, which is
 * what the rule asks for in the overwhelming majority of cases, and with a
 * space collapse so "word — word" does not become "word , word".
 *
 * Applied to the OUTPUT rather than at the ten yield sites inside, so a new
 * yield added later cannot quietly opt out.
 */
function stripEmDashes(text: string): string {
  return text.replace(/\s*[—–]\s*/g, ", ")
}

/**
 * The public entry point: sanitises output, and falls back to Groq when the
 * Claude attempt FAILS rather than only when Claude is unconfigured.
 *
 * WHY THIS EXISTS. The fallback was gated on `!getAnthropicClient()`, so it ran
 * only when ANTHROPIC_API_KEY was absent. That is the one situation it was
 * never needed in. The situations it WAS built for, an exhausted balance, a
 * 429, a provider outage, all leave the key present and the call throwing, so
 * every user got "Sorry, something went wrong" while a working second provider
 * sat unused. Found during go-live review for the first pilot.
 *
 * ONLY BEFORE THE FIRST TOKEN. We stream, so once text has reached the user we
 * cannot restart the turn on another model: they would see an answer change
 * shape mid-sentence, or read two different answers stitched together. A
 * failure after that point is re-thrown and handled by the route, which is the
 * honest outcome. A failure before it is invisible to the user, which is the
 * point.
 */
export async function* streamChatWithTools(
  systemPrompt: string,
  messages: ChatMessage[],
  walletConfig: WalletConfig | null,
  watchedContracts: WatchedContractSnapshot[] = [],
  maxTokens = 800,
  actions: ActionsContext | null = null,
  docsBlock?: string,
): AsyncGenerator<StreamEvent> {
  const clean = (e: StreamEvent): StreamEvent =>
    e.type === "text" ? { ...e, text: stripEmDashes(e.text) } : e

  let textReachedUser = false
  try {
    for await (const event of streamChatWithToolsRaw(
      systemPrompt, messages, walletConfig, watchedContracts, maxTokens, actions, docsBlock,
    )) {
      if (event.type === "text" && event.text.length > 0) textReachedUser = true
      yield clean(event)
    }
    return
  } catch (err) {
    if (textReachedUser) throw err
    // Nothing has been shown yet, so the turn can be run again on the other
    // provider and the user never learns the first one failed.
    console.error("[stream] Claude failed before first token, falling back to Groq:", err)
  }

  for await (const event of streamChatWithToolsRaw(
    systemPrompt, messages, walletConfig, watchedContracts, maxTokens, actions, docsBlock, true,
  )) {
    yield clean(event)
  }
}

async function* streamChatWithToolsRaw(
  systemPrompt: string,
  messages: ChatMessage[],
  walletConfig: WalletConfig | null,
  watchedContracts: WatchedContractSnapshot[] = [],
  maxTokens = 800,
  actions: ActionsContext | null = null,
  docsBlock?: string,
  /** Take the Groq path even though Claude is configured. Set by the wrapper
   *  when a Claude attempt has already failed. */
  forceFallback = false,
): AsyncGenerator<StreamEvent> {
  const anthropic = forceFallback ? null : getAnthropicClient()

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
      ...(needsWalletTools ? [buildWalletDiagnosisTool()] : []),
      buildNativePriceTool(),
      buildSanctionsTool(),
      buildTokenSafetyTool(),
      buildEnsTool(),
      ...(walletConfig ? [buildEstimateActionTool(watchedContracts)].filter((t): t is NonNullable<typeof t> => t !== null) : []),
      ...(walletConfig && actions
        ? [buildPrepareContractActionTool(actions, watchedContracts), buildPrepareSwapTool(actions)]
            .filter((t): t is NonNullable<typeof t> => t !== null)
        : []),
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
            } catch { /* malformed args from the model, escalate with defaults */ }
            yield { type: "escalate", summary: input.summary ?? "Issue needs further attention", reason: input.reason ?? "unresolved" }
            return
          }

          for (const tc of fnCalls) {
            yield { type: "tool_call", tool: tc.function.name }
          }

          groqMessages.push({ role: "assistant", content: msg.content ?? null, ...(msg.tool_calls ? { tool_calls: msg.tool_calls } : {}) })

          const executed = await Promise.all(
            fnCalls.map(async (tc) => {
              try {
                const input = JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>
                const result = await executeToolWithTimeout(tc.function.name, input, walletConfig, watchedContracts, actions)
                return { name: tc.function.name, id: tc.id, result: result as unknown, error: null as unknown }
              } catch (err) {
                return { name: tc.function.name, id: tc.id, result: null as unknown, error: err }
              }
            }),
          )

          yield {
            type: "tool_evidence",
            items: executed.map(e => toolEvidenceFrom(e.name, e.result, e.error != null)),
          }

          // Surface any client-side actions a tool asked for (e.g. switch network).
          for (const ev of clientActionsFrom(executed)) yield ev

          const toolResults = executed.map(({ id, result, error }) =>
            error
              ? { role: "tool" as const, tool_call_id: id, content: `Error: ${error instanceof Error ? error.message : "Tool failed"}` }
              : { role: "tool" as const, tool_call_id: id, content: JSON.stringify(stripClientAction(result), null, 2) },
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
    ...(walletConfig ? [buildWalletDiagnosisTool()] : []),
    buildNativePriceTool(),
    buildSanctionsTool(),
    buildTokenSafetyTool(),
    buildEnsTool(),
    ...(walletConfig ? [buildEstimateActionTool(watchedContracts)].filter((t): t is NonNullable<typeof t> => t !== null) : []),
    ...(walletConfig && actions
      ? [buildPrepareContractActionTool(actions, watchedContracts), buildPrepareSwapTool(actions)]
          .filter((t): t is NonNullable<typeof t> => t !== null)
      : []),
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
  let totalCacheReadTokens = 0
  let totalCacheWriteTokens = 0
  let totalOutputTokens = 0
  let endedWithText = false
  let anyTextThisTurn = false

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      system: cachedSystem(systemPrompt, docsBlock),
      messages: currentMessages,
      ...(tools.length > 0 ? { tools } : {}),
    })

    let hasToolCalls = false
    const emittedToolIds = new Set<string>()

    // Text written immediately before a tool call is the model thinking aloud
    // ("I need to look up the fee structure. Let me list the functions."). The
    // widget already shows a live label for every tool call, so that narration
    // is a second, worse status line, and consecutive rounds run together with
    // no paragraph break. Hold text back until either a tool call proves it was
    // narration (drop it) or the round ends without one (it was the answer).
    //
    // The cap exists so a long final answer still streams: narration is a
    // sentence or two, so anything past it is real content and flushes live.
    let pending = ""
    let pendingSince = 0
    let flushed = false

    for await (const event of stream) {
      if (
        event.type === "content_block_start" &&
        event.content_block.type === "tool_use" &&
        !emittedToolIds.has(event.content_block.id)
      ) {
        emittedToolIds.add(event.content_block.id)
        hasToolCalls = true
        // ESCALATION IS NOT NARRATION. Held-back text is normally discarded
        // when a tool call proves it was "let me check that for you". For
        // create_support_ticket the text before the call IS the answer, the
        // line acknowledging what the user said, and the widget STOPS the
        // stream on the escalate event, so dropping it loses it rather than
        // deferring it. A tester who left feedback got an empty bubble and
        // then a form, which reads as the assistant having given up.
        if (event.content_block.name === "create_support_ticket" && pending.trim()) {
          yield { type: "text", text: separate(pending, anyTextThisTurn) }
          anyTextThisTurn = true
        }
        pending = ""
        yield { type: "tool_call", tool: event.content_block.name }
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        if (flushed) {
          yield { type: "text", text: event.delta.text }
          continue
        }
        if (!pending) pendingSince = Date.now()
        pending += event.delta.text
        if (pending.length > NARRATION_CHARS || Date.now() - pendingSince > NARRATION_HOLD_MS) {
          flushed = true
          yield { type: "text", text: separate(pending, anyTextThisTurn) }
          anyTextThisTurn = true
          pending = ""
        }
      }
    }

    if (pending && !hasToolCalls) {
      yield { type: "text", text: separate(pending, anyTextThisTurn) }
      anyTextThisTurn = true
    }

    // Token usage for this round (the SDK accumulated the full message during
    // streaming, so finalMessage() is cheap). Summed across rounds = the real
    // tokens charged for this turn.
    const finalMsg = await stream.finalMessage()
    totalInputTokens += finalMsg.usage.input_tokens
    totalOutputTokens += finalMsg.usage.output_tokens
    totalCacheReadTokens += finalMsg.usage.cache_read_input_tokens ?? 0
    totalCacheWriteTokens += finalMsg.usage.cache_creation_input_tokens ?? 0

    // Claude gave a text response with no tool calls — done
    if (!hasToolCalls) { endedWithText = true; break }

    const toolUseBlocks = finalMsg.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    )

    // Escalation is handled client-side — yield event and stop stream
    const escalationBlock = toolUseBlocks.find(b => b.name === "create_support_ticket")
    if (escalationBlock) {
      const input = escalationBlock.input as { summary?: string; reason?: string }
      const reason = input.reason ?? "unresolved"
      // NEVER END A TURN WITH NOTHING RECORDED. When the model goes straight to
      // the tool with no preceding text, the widget showed a confirmation it
      // had made up client-side while the TRANSCRIPT stored an empty assistant
      // message. The tester read "logged for the team" and the case record kept
      // a blank, which is the one thing this product cannot do. Emitting it
      // here means what they saw is what is stored.
      if (!anyTextThisTurn) {
        yield {
          type: "text",
          text: reason === "bug"
            ? "Thanks, that's logged for the team with everything I could see."
            : reason === "feedback"
              ? "Thanks, that's recorded for the team."
              : "I've passed this to the team.",
        }
        anyTextThisTurn = true
      }
      yield { type: "escalate", summary: input.summary ?? "Issue needs further attention", reason }
      yield { type: "usage", inputTokens: totalInputTokens, outputTokens: totalOutputTokens, cacheReadTokens: totalCacheReadTokens, cacheWriteTokens: totalCacheWriteTokens, model: MODEL }
      return
    }

    // Execute all wallet tool calls in parallel
    const executed = await Promise.all(
      toolUseBlocks.map(async (block) => {
        try {
          const result = await executeToolWithTimeout(
            block.name,
            block.input as Record<string, unknown>,
            walletConfig,
            watchedContracts,
            actions,
          )
          return { name: block.name, id: block.id, result: result as unknown, error: null as unknown }
        } catch (err) {
          return { name: block.name, id: block.id, result: null as unknown, error: err }
        }
      }),
    )

    // Surface any client-side actions a tool asked for (e.g. switch network).
    for (const ev of clientActionsFrom(executed)) yield ev

    yield {
      type: "tool_evidence",
      items: executed.map(e => toolEvidenceFrom(e.name, e.result, e.error != null)),
    }

    const toolResults = executed.map(({ id, result, error }) =>
      error
        ? {
            type: "tool_result" as const,
            tool_use_id: id,
            content: `Error: ${error instanceof Error ? error.message : "Tool execution failed"}`,
            is_error: true,
          }
        : {
            type: "tool_result" as const,
            tool_use_id: id,
            content: JSON.stringify(stripClientAction(result), null, 2),
          },
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
        // The wrap-up instruction goes in a SEPARATE trailing block: appending
        // it to the prompt string would change the cached prefix's bytes and
        // force a full re-read on the most expensive call of the turn.
        system: [
          ...cachedSystem(systemPrompt, docsBlock),
          { type: "text", text: "You have gathered tool results above. Give the user your best final answer now in plain English, using what you found. Do not call any more tools." },
        ],
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
      totalCacheReadTokens += fm.usage.cache_read_input_tokens ?? 0
      totalCacheWriteTokens += fm.usage.cache_creation_input_tokens ?? 0
    } catch { /* fall through to the guaranteed fallback below */ }
  }

  // Absolute backstop: never end a turn with zero text.
  if (!anyTextThisTurn) {
    yield { type: "text", text: "I looked into that but couldn't complete the diagnosis in one go. Could you rephrase, or share the specific transaction hash so I can dig in directly?" }
  }

  yield { type: "usage", inputTokens: totalInputTokens, outputTokens: totalOutputTokens, cacheReadTokens: totalCacheReadTokens, cacheWriteTokens: totalCacheWriteTokens, model: MODEL }
}

// ── Text-only helpers ────────────────────────────────────────────────────────

/**
 * Simple text-only stream with no tool use. Used by completeChat.
 */
export async function* streamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 2048,
  docsBlock?: string,
): AsyncGenerator<string> {
  const anthropic = getAnthropicClient()

  if (anthropic) {
    const stream = anthropic.messages.stream({
      model: "claude-haiku-4-5-20251001",
      max_tokens: maxTokens,
      system: cachedSystem(systemPrompt, docsBlock),
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

/**
 * Like completeChat but also returns token usage, so callers (e.g. the Telegram
 * webhook) can record it for the admin cost cockpit. usage is null on the Groq
 * fallback path (no per-turn accounting there).
 */
export async function completeChatWithUsage(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 2048,
  docsBlock?: string,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string } | null }> {
  const anthropic = getAnthropicClient()
  if (anthropic) {
    const MODEL = "claude-haiku-4-5-20251001"
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: maxTokens,
      system: cachedSystem(systemPrompt, docsBlock),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    })
    let text = ""
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") text += event.delta.text
    }
    const fm = await stream.finalMessage()
    return { text, usage: {
      inputTokens: fm.usage.input_tokens,
      outputTokens: fm.usage.output_tokens,
      cacheReadTokens: fm.usage.cache_read_input_tokens ?? 0,
      cacheWriteTokens: fm.usage.cache_creation_input_tokens ?? 0,
      model: MODEL,
    } }
  }
  let text = ""
  for await (const chunk of streamChat(systemPrompt, messages, maxTokens)) text += chunk
  return { text, usage: null }
}

/**
 * The full agentic tool loop, collected into a single reply for channels that
 * deliver one message rather than a stream (Telegram). Same engine as the
 * widget: tx-hash diagnosis, contract reads, and, when the caller detected a
 * pasted address, the wallet tools too. Escalation is surfaced as data, not
 * rendered: the widget shows a ticket form, but a chat channel has to decide
 * for itself what "escalate" means (notify integrations, point at the team).
 */
export async function completeChatWithToolsUsage(
  systemPrompt: string,
  messages: ChatMessage[],
  walletConfig: WalletConfig | null,
  watchedContracts: WatchedContractSnapshot[] = [],
  maxTokens = 800,
): Promise<{
  text: string
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string } | null
  escalation: { summary: string; reason: string } | null
  toolsUsed: string[]
}> {
  let text = ""
  let usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string } | null = null
  let escalation: { summary: string; reason: string } | null = null
  const toolsUsed: string[] = []
  for await (const event of streamChatWithTools(systemPrompt, messages, walletConfig, watchedContracts, maxTokens)) {
    if (event.type === "text") text += event.text
    else if (event.type === "usage") {
      usage = {
        inputTokens: event.inputTokens,
        outputTokens: event.outputTokens,
        cacheReadTokens: event.cacheReadTokens,
        cacheWriteTokens: event.cacheWriteTokens,
        model: event.model,
      }
    } else if (event.type === "escalate") escalation = { summary: event.summary, reason: event.reason }
    else if (event.type === "tool_call" && !toolsUsed.includes(event.tool)) toolsUsed.push(event.tool)
  }
  return { text, usage, escalation, toolsUsed }
}
