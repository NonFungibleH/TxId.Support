import { waitUntil } from "@vercel/functions"
import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { buildSystemPrompt, completeChatWithToolsUsage } from "@txid/ai"
import type { ChatMessage, ProjectConfigSnapshot, WalletConfig, WatchedContractSnapshot } from "@txid/ai"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_CONV_LIMITS, resolveDisclaimer } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"
import { log } from "@/lib/logger"
import { rateLimit } from "@/lib/rate-limit"
import { TELEGRAM_LIMITS } from "@/lib/limits"
import { checkSpendBudget } from "@/lib/spend-guard"
import { dispatchEscalation } from "@/lib/integrations/escalation"

// The tool loop makes real on-chain reads across up to 5 rounds, so a reply
// can legitimately take longer than the default function window.
export const maxDuration = 60

// Constant-time compare of the webhook secret token. A plain !== leaks the
// secret_key through timing (audit H1); secret_key also gates the AI pipeline,
// so a leak lets an attacker forge Telegram updates and drain quota.
function secretsMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

// ── Telegram update types ──────────────────────────────────────────────────────

interface TelegramUser {
  id: number
  first_name: string
  username?: string
  is_bot?: boolean
}

interface TelegramChat {
  id: number
  type: "private" | "group" | "supergroup" | "channel"
}

interface TelegramEntity {
  type: string
  offset: number
  length: number
}

interface TelegramMessage {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  text?: string
  entities?: TelegramEntity[]
  reply_to_message?: { from?: TelegramUser }
}

interface TelegramUpdate {
  update_id: number
  message?: TelegramMessage
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function shouldRespond(message: TelegramMessage): boolean {
  if (message.chat.type === "private") return true

  const entities = message.entities ?? []
  if (entities.some(e => e.type === "mention" || e.type === "bot_command")) return true
  if (message.reply_to_message?.from?.is_bot) return true

  return false
}

function cleanText(message: TelegramMessage): string {
  let text = message.text ?? ""
  const entities = message.entities ?? []

  // Strip leading @mention (e.g. "@MyBot how do I...") and /commands
  const leading = entities
    .filter(e => (e.type === "mention" || e.type === "bot_command") && e.offset === 0)
    .sort((a, b) => b.length - a.length)[0]

  if (leading) {
    text = text.slice(leading.length).trimStart()
  }

  return text.trim()
}

// Returns the leading bot command without its @botname suffix, lowercased
// (e.g. "/start@foo_bot" → "/start"). Null when the message doesn't lead
// with a command. Used to answer /start, /help, and a bare /ask with a
// canned reply instead of silently dropping them.
function leadingCommand(message: TelegramMessage): string | null {
  const cmd = (message.entities ?? []).find(e => e.type === "bot_command" && e.offset === 0)
  if (!cmd) return null
  return (message.text ?? "").slice(0, cmd.length).split("@")[0].toLowerCase()
}

function commandReply(command: string, projectName: string, isPrivate: boolean, diagnostics: boolean): string | null {
  // Copy must match what the bot actually does: a diagnostics-off project does
  // NOT debug transactions, so /start and /help (and the example) must not
  // advertise it, or a user is taught to ask exactly what the bot will refuse.
  const example = diagnostics ? "why did my transaction fail?" : "how does staking work?"
  const howToAsk = isPrivate
    ? "Just send me a message with your question."
    : `Tag me or use /ask, for example:\n/ask ${example}`
  const canDo = diagnostics
    ? "how it works, your transactions, contract errors, and more"
    : "how it works and questions from the docs"
  const helpCan = diagnostics
    ? "I can explain how the protocol works, help diagnose failed or stuck transactions, and answer questions from the docs."
    : "I can explain how the protocol works and answer questions from the docs."
  switch (command) {
    case "/start":
      return `👋 Hi! I'm the AI support assistant for ${projectName}. Ask me anything about the protocol: ${canDo}.\n\n${howToAsk}`
    case "/help":
      return `I'm the ${projectName} support assistant. ${helpCan}\n\n${howToAsk}`
    case "/ask":
      return isPrivate
        ? "What would you like to know? Send me your question and I'll help."
        : `Add your question after /ask, for example:\n/ask ${example}`
    default:
      return null
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

function markdownToHtml(text: string): string {
  const placeholders: string[] = []

  text = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code: string) => {
    const idx = placeholders.length
    placeholders.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`)
    return `\x00${idx}\x00`
  })

  text = text.replace(/`([^`\n]+)`/g, (_, code: string) => {
    const idx = placeholders.length
    placeholders.push(`<code>${escapeHtml(code)}</code>`)
    return `\x00${idx}\x00`
  })

  text = escapeHtml(text)
  text = text.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
  text = text.replace(/\*(.+?)\*/g, "<i>$1</i>")
  text = text.replace(/^#{1,3}\s+(.+)$/gm, "<b>$1</b>")
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  text = text.replace(/\x00(\d+)\x00/g, (_, i: string) => placeholders[parseInt(i)])
  return text
}

async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
  replyToMessageId: number,
  replyMarkup?: { inline_keyboard: { text: string; url: string }[][] },
): Promise<void> {
  const html = markdownToHtml(text)
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: html,
      parse_mode: "HTML",
      reply_to_message_id: replyToMessageId,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  })
}

// "typing…" indicator while the tool loop runs. On-chain reads can take tens
// of seconds; without this the group just sees silence and re-asks.
function sendTypingAction(token: string, chatId: number): void {
  void fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" }),
  }).catch(() => {})
}

/**
 * Detect a pasted wallet address in the conversation and turn it into the
 * same WalletConfig the widget builds on connect, so the wallet tools
 * (balances, history, diagnosis, protocol accounts) work from a paste.
 *
 * Rules, most recent mention wins:
 * - 40-hex 0x is an EVM ADDRESS (a 64-hex on EVM is a tx hash, never a wallet)
 *   → first configured EVM chain.
 * - On projects watching Aptos, any other 1-64-hex 0x could be an Aptos
 *   address (or a tx hash: both are 64-hex there). Pass it as the wallet
 *   anyway and let the model pick the right tool; a hash misread as a wallet
 *   reads as an empty account, never as wrong data.
 */
function detectWalletConfig(texts: string[], config: ProjectConfig): WalletConfig | null {
  const chains = new Set<string>([
    ...(config.watchedContracts ?? []).map(c => c.chain),
    ...(config.chains ?? []),
  ])
  const hasAptos = chains.has("aptos")
  const evmChain = [...chains].find(c => c.startsWith("0x"))

  const tokens = texts.join("\n").match(/0x[0-9a-fA-F]{1,64}/g) ?? []
  for (const t of tokens.reverse()) {
    const hexLen = t.length - 2
    if (hexLen === 40 && evmChain) return { address: t, chainId: evmChain }
    if (hexLen === 40 && !evmChain && hasAptos) return { address: t, chainId: "aptos" }
    if (hexLen !== 40 && hasAptos) return { address: t, chainId: "aptos" }
  }
  return null
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(
  request: Request,
  { params }: { params: { key: string } },
) {
  const { key } = params

  const supabase = createServiceClient()

  const { data: projectData, error: projectError } = await supabase
    .from("projects")
    .select("id, name, config, secret_key, publishable_key")
    .eq("publishable_key", key)
    .single()

  if (projectError || !projectData) {
    return new Response("Not found", { status: 404 })
  }

  const project = projectData as unknown as ProjectRow & { name: string }
  const secretKey = (project as unknown as { secret_key: string }).secret_key

  // Verify Telegram's webhook secret token (constant-time - see secretsMatch)
  const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token")
  if (!incomingSecret || !secretsMatch(incomingSecret, secretKey)) {
    return new Response("Unauthorized", { status: 401 })
  }

  const config = project.config as unknown as ProjectConfig
  const botToken = config.telegramBotToken
  if (!botToken) {
    return new Response("No bot token configured", { status: 200 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch {
    return new Response("Bad request", { status: 400 })
  }

  const message = update.message
  if (!message?.text || !message.from) {
    return new Response("OK", { status: 200 })
  }

  if (!shouldRespond(message)) {
    return new Response("OK", { status: 200 })
  }

  const userText = cleanText(message)
  const command = leadingCommand(message)

  // /start and /help always get the canned reply, even with a payload: the
  // group reply's "Continue privately" button deep-links to "/start support",
  // which must greet, not send the word "support" to the model. /ask with a
  // question falls through to the AI. No AI call here, so no quota or
  // conversation row is consumed.
  if (command === "/start" || command === "/help" || !userText) {
    const reply = command ? commandReply(command, project.name, message.chat.type === "private", config.diagnostics !== false) : null
    if (reply) {
      await sendTelegramMessage(botToken, message.chat.id, reply, message.message_id)
    }
    return new Response("OK", { status: 200 })
  }

  // ── Monthly quota check ───────────────────────────────────────────────────────
  const monthlyLimit = PLAN_CONV_LIMITS[(config.plan ?? "free") as Plan]
  if (monthlyLimit !== Infinity) {
    const startOfMonth = new Date()
    startOfMonth.setUTCDate(1)
    startOfMonth.setUTCHours(0, 0, 0, 0)
    const { count: monthlyCount } = await supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", project.id)
      .gte("created_at", startOfMonth.toISOString())
    if ((monthlyCount ?? 0) >= monthlyLimit) {
      await sendTelegramMessage(
        botToken,
        message.chat.id,
        "This protocol's support bot has reached its monthly conversation limit. Please try again next month or contact the team directly.",
        message.message_id,
      )
      return new Response("OK", { status: 200 })
    }
  }

  // Session is per-user within each chat - prevents context bleed between group members
  const sessionId = `tg-${message.chat.id}-${message.from.id}`

  // Rate limit BEFORE any model call. The monthly conversation quota counts
  // conversations, not messages, so one long-lived chat would otherwise allow
  // unlimited AI completions: a spammy group, or anyone who learns the webhook
  // secret, could drain LLM spend indefinitely. Keyed per chat and per sender
  // so one abusive user cannot starve the rest of a legitimate group.
  const tgLimits = await Promise.all([
    rateLimit(`tg:${project.id}:${message.chat.id}`, TELEGRAM_LIMITS.perChatPerWindow, TELEGRAM_LIMITS.windowMs),
    rateLimit(`tg:${project.id}:u:${message.from.id}`, TELEGRAM_LIMITS.perUserPerWindow, TELEGRAM_LIMITS.windowMs),
    // Daily ceiling per chat. The per-minute windows bound the RATE but not
    // the total: a busy group at 20 msgs/min could still run ~29k full tool
    // loops in a day with the monthly quota never biting (one chat is one
    // conversation forever). This is the Telegram equivalent of the widget's
    // per-session message cap.
    rateLimit(`tg-day:${project.id}:${message.chat.id}`, TELEGRAM_LIMITS.perChatPerDay, 86_400_000),
  ])
  if (tgLimits.some(r => !r.allowed)) {
    log.warn("Telegram rate limited", { event: "telegram.rate_limited", projectId: project.id, chatId: String(message.chat.id) })
    // 200 so Telegram does not retry the update into the same wall.
    return new Response("OK", { status: 200 })
  }

  // Last line of defence on cost, same breaker the widget chat runs behind.
  // Telegram was the one surface that skipped it: a spammy group ran the full
  // tool loop all day with no automatic stop. Checked after the cheap rate
  // limits and before any model call, so a breach costs nothing.
  const tgBudget = await checkSpendBudget(supabase, project.id)
  if (!tgBudget.allowed) {
    log.warn("Telegram blocked by spend guard", { event: "telegram.spend_blocked", projectId: project.id, scope: tgBudget.scope })
    // Silent to the chat: a budget message in a public group invites probing.
    return new Response("OK", { status: 200 })
  }

  // Load recent message history from Supabase for context
  const { data: convData } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", project.id)
    .eq("session_id", sessionId)
    .maybeSingle()

  let historyMessages: ChatMessage[] = []
  if (convData) {
    const { data: msgRows } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", convData.id)
      .order("created_at", { ascending: true })
      .limit(20)

    if (msgRows) {
      historyMessages = (msgRows as { role: string; content: string }[]).map(r => ({
        role: r.role as "user" | "assistant",
        content: r.content,
      }))
    }
  }

  const incomingMessage: ChatMessage = { role: "user", content: userText }
  const messages: ChatMessage[] = [...historyMessages, incomingMessage]

  const tgDocLinks = (config.contentBlocks ?? [])
    .filter(bl => bl.type === "docs")
    .flatMap(bl => {
      const c = (bl.content && typeof bl.content === "object" ? bl.content : {}) as Record<string, string>
      return [1, 2, 3, 4, 5]
        .map(n => ({ label: (c[`label${n}`] ?? "").trim(), url: (c[`url${n}`] ?? "").trim() }))
        .filter(p => p.url)
        .map(p => ({ label: p.label || p.url, url: p.url }))
    })
    .slice(0, 20)

  // Same snapshot the widget chat route builds: abi + errorGlossary included,
  // or the contract-read tools are never offered and the team's custom error
  // wording never reaches the prompt.
  const watchedContracts: WatchedContractSnapshot[] = (config.watchedContracts ?? []).map(c => ({
    id: c.id,
    name: c.name,
    address: c.address,
    chain: c.chain,
    description: c.description,
    ...(c.moduleName ? { moduleName: c.moduleName } : {}),
    ...(c.errorGlossary ? { errorGlossary: c.errorGlossary } : {}),
    ...(c.abi ? { abi: c.abi } : {}),
    ...(c.abiSource ? { abiSource: c.abiSource } : {}),
  }))

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
    watchedContracts,
    docsUrl: config.docsUrl,
    ...(tgDocLinks.length > 0 ? { docLinks: tgDocLinks } : {}),
  }

  // A pasted address unlocks the wallet toolset, exactly like connecting in
  // the widget. Scan the current message first, then recent history, so a
  // follow-up question keeps the wallet from two messages ago.
  // Same on-chain-diagnosis switch as the widget: a diagnostics-off protocol
  // must refuse transaction debugging on every surface, Telegram included.
  const diagnosticsOn = config.diagnostics !== false

  const walletConfig = diagnosticsOn
    ? detectWalletConfig(
        [...historyMessages.filter(m => m.role === "user").map(m => m.content), userText],
        config,
      )
    : null

  const systemPrompt = buildSystemPrompt({
    projectName: project.name,
    config: configSnapshot,
    walletConfig,
    ragContext: "",
    mode: "support",
    persona: config.branding?.persona ?? "concise",
    customTone: config.branding?.customTone ?? undefined,
    ...(config.branding?.language ? { language: config.branding.language } : {}),
    diagnostics: diagnosticsOn,
  })

  sendTypingAction(botToken, message.chat.id)

  let reply: string
  let usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string } | null = null
  let escalation: { summary: string; reason: string } | null = null
  try {
    const res = await completeChatWithToolsUsage(systemPrompt, messages, walletConfig, watchedContracts, 800, diagnosticsOn)
    reply = res.text
    usage = res.usage
    escalation = res.escalation
  } catch (err) {
    log.error("Telegram AI completion failed", err, {
      event: "telegram.webhook.ai_error",
      projectId: project.id,
      chatType: message.chat.type,
    })
    return new Response("OK", { status: 200 })
  }

  if (!reply.trim()) {
    // The model went straight to escalation (or produced nothing). Never send
    // an empty Telegram message: it 400s and the user sees silence.
    reply = escalation
      ? "This needs a human from the team to look at."
      : "Sorry, I couldn't work that one out. Could you rephrase, or share a transaction hash?"
  }

  // Escalation in a chat channel: notify the team's configured integrations
  // (Slack/Discord/issue trackers) with the summary and recent context, and
  // tell the user honestly what happened. No ticket form exists here, so
  // WITHOUT integrations nothing is recorded server-side and the reply must
  // not pretend otherwise.
  const integrations = config.integrations
  const integrationsConfigured = !!integrations && Object.values(integrations).some(v => !!v)
  if (escalation) {
    if (integrationsConfigured) {
      const ref = `TG-${Date.now().toString(36).toUpperCase()}`
      waitUntil(dispatchEscalation(
      supabase,
        project.id,
        null,
        {
          ref,
          projectName: project.name,
          summary: escalation.summary,
          reason: escalation.reason,
          userName: message.from.username ? `@${message.from.username}` : message.from.first_name,
          conversation: [...messages.slice(-6), { role: "assistant", content: reply }],
          disclaimer: resolveDisclaimer(config.branding) || null,
        },
        integrations,
        botToken,
      ))
      reply += `\n\nI've flagged this to the team (ref ${ref}). They can see this conversation and will follow up.`
    } else {
      reply += "\n\nThis needs someone from the team: please reach them through their official channels and share this conversation."
    }
  }

  // In groups, offer to continue one-on-one: keeps long investigations out of
  // the channel, and the DM session is recorded separately per user.
  const botUsername = config.telegramBotUsername
  const dmButton =
    message.chat.type !== "private" && botUsername
      ? { inline_keyboard: [[{ text: "💬 Continue privately", url: `https://t.me/${botUsername}?start=support` }]] }
      : undefined

  await sendTelegramMessage(botToken, message.chat.id, reply, message.message_id, dmButton)

  // Persist to Supabase
  // Same race as the chat route: void meant the function could freeze
  // before the write landed. waitUntil holds it open, costs no latency.
  waitUntil(persistTelegramMessages(supabase, project.id, sessionId, userText, reply, usage))

  return new Response("OK", { status: 200 })
}

async function persistTelegramMessages(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  sessionId: string,
  userText: string,
  assistantReply: string,
  usage?: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; model: string } | null,
) {
  try {
    const { data: conv } = await supabase
      .from("conversations")
      .upsert(
        { project_id: projectId, session_id: sessionId, wallet_address: null, chain_id: null },
        { onConflict: "project_id,session_id" },
      )
      .select("id")
      .single()

    if (!conv) return

    // Distinct times per row: a single insert takes one transaction timestamp
    // for both, which made every exchange look instantaneous and left the sort
    // order to break ties by insertion rather than by time.
    const tgAnsweredAt = new Date()
    await supabase.from("messages").insert([
      { conversation_id: conv.id, role: "user" as const, content: userText, created_at: new Date(tgAnsweredAt.getTime() - 1000).toISOString() },
      { conversation_id: conv.id, role: "assistant" as const, content: assistantReply, created_at: tgAnsweredAt.toISOString() },
    ])
    // Stamp last_message_at so the conversation is flagged for (re-)summary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id)

    // Record token usage so Telegram AI cost shows in the admin cockpit too
    // (previously widget-only). Denormalised project_id, same as the chat route.
    if (usage && (usage.inputTokens > 0 || usage.outputTokens > 0)) {
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
  } catch {
    // Non-fatal
  }
}
