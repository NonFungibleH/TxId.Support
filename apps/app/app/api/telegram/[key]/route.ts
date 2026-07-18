import crypto from "crypto"
import { createServiceClient } from "@/lib/supabase/server"
import { buildSystemPrompt, completeChatWithUsage } from "@txid/ai"
import type { ChatMessage, ProjectConfigSnapshot } from "@txid/ai"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_CONV_LIMITS } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"
import { log } from "@/lib/logger"

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

function commandReply(command: string, projectName: string, isPrivate: boolean): string | null {
  const howToAsk = isPrivate
    ? "Just send me a message with your question."
    : "Tag me or use /ask, for example:\n/ask why did my transaction fail?"
  switch (command) {
    case "/start":
      return `👋 Hi! I'm the AI support assistant for ${projectName}. Ask me anything about the protocol: how it works, your transactions, contract errors, and more.\n\n${howToAsk}`
    case "/help":
      return `I'm the ${projectName} support assistant. I can explain how the protocol works, help diagnose failed or stuck transactions, and answer questions from the docs.\n\n${howToAsk}`
    case "/ask":
      return isPrivate
        ? "What would you like to know? Send me your question and I'll help."
        : "Add your question after /ask, for example:\n/ask why did my transaction fail?"
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
    }),
  })
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

  // Verify Telegram's webhook secret token (constant-time — see secretsMatch)
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
  if (!userText) {
    // Bare command with no question (/start, /help, /ask) — answer with a
    // canned reply instead of dropping it silently. No AI call, so this
    // doesn't consume quota or create a conversation row.
    const command = leadingCommand(message)
    if (command) {
      const reply = commandReply(command, project.name, message.chat.type === "private")
      if (reply) {
        await sendTelegramMessage(botToken, message.chat.id, reply, message.message_id)
      }
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

  // Session is per-user within each chat — prevents context bleed between group members
  const sessionId = `tg-${message.chat.id}-${message.from.id}`

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
    watchedContracts: (config.watchedContracts ?? []).map(c => ({
      id: c.id,
      name: c.name,
      address: c.address,
      chain: c.chain,
      description: c.description,
    })),
    docsUrl: config.docsUrl,
    ...(tgDocLinks.length > 0 ? { docLinks: tgDocLinks } : {}),
  }

  const systemPrompt = buildSystemPrompt({
    projectName: project.name,
    config: configSnapshot,
    walletConfig: null,
    ragContext: "",
    mode: "support",
    persona: config.branding?.persona ?? "concise",
    ...(config.branding?.language ? { language: config.branding.language } : {}),
  })

  let reply: string
  let usage: { inputTokens: number; outputTokens: number; model: string } | null = null
  try {
    const res = await completeChatWithUsage(systemPrompt, messages, 800)
    reply = res.text
    usage = res.usage
  } catch (err) {
    log.error("Telegram AI completion failed", err, {
      event: "telegram.webhook.ai_error",
      projectId: project.id,
      chatType: message.chat.type,
    })
    return new Response("OK", { status: 200 })
  }

  await sendTelegramMessage(botToken, message.chat.id, reply, message.message_id)

  // Persist to Supabase
  void persistTelegramMessages(supabase, project.id, sessionId, userText, reply, usage)

  return new Response("OK", { status: 200 })
}

async function persistTelegramMessages(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  sessionId: string,
  userText: string,
  assistantReply: string,
  usage?: { inputTokens: number; outputTokens: number; model: string } | null,
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

    await supabase.from("messages").insert([
      { conversation_id: conv.id, role: "user" as const, content: userText },
      { conversation_id: conv.id, role: "assistant" as const, content: assistantReply },
    ])
    // Stamp last_message_at so the conversation is flagged for (re-)summary.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conv.id)

    // Record token usage so Telegram AI cost shows in the admin cockpit too
    // (previously widget-only). Denormalised project_id, same as the chat route.
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
