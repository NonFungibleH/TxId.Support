import { createServiceClient } from "@/lib/supabase/server"
import { buildSystemPrompt, completeChat } from "@txid/ai"
import type { ChatMessage, ProjectConfigSnapshot } from "@txid/ai"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

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

  // Verify Telegram's webhook secret token
  const incomingSecret = request.headers.get("x-telegram-bot-api-secret-token")
  if (!incomingSecret || incomingSecret !== secretKey) {
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
    return new Response("OK", { status: 200 })
  }

  // Session is per-chat (groups share one context, DMs are per-user)
  const sessionId = `tg-${message.chat.id}`

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
  try {
    reply = await completeChat(systemPrompt, messages, 800)
  } catch (err) {
    console.error("[telegram/chat]", err)
    return new Response("OK", { status: 200 })
  }

  await sendTelegramMessage(botToken, message.chat.id, reply, message.message_id)

  // Persist to Supabase
  void persistTelegramMessages(supabase, project.id, sessionId, userText, reply)

  return new Response("OK", { status: 200 })
}

async function persistTelegramMessages(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  sessionId: string,
  userText: string,
  assistantReply: string,
) {
  try {
    const { data: conv } = await supabase
      .from("conversations")
      .upsert(
        { project_id: projectId, session_id: sessionId, wallet_address: null, chain_id: null },
        { onConflict: "session_id" },
      )
      .select("id")
      .single()

    if (!conv) return

    await supabase.from("messages").insert([
      { conversation_id: conv.id, role: "user" as const, content: userText },
      { conversation_id: conv.id, role: "assistant" as const, content: assistantReply },
    ])
  } catch {
    // Non-fatal
  }
}
