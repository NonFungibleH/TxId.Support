import Anthropic from "@anthropic-ai/sdk"
import type { ChatMessage } from "./types"

const MODEL = "claude-sonnet-4-6"

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set")
    _client = new Anthropic({ apiKey })
  }
  return _client
}

/**
 * Stream a Claude response as an async generator of text chunks.
 * The caller is responsible for building the system prompt.
 */
export async function* streamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 1024,
): AsyncGenerator<string> {
  const client = getClient()

  const stream = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    stream: true,
  })

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text
    }
  }
}

/**
 * Collect the full streamed response into a single string (non-streaming).
 */
export async function completeChat(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 1024,
): Promise<string> {
  let result = ""
  for await (const chunk of streamChat(systemPrompt, messages, maxTokens)) {
    result += chunk
  }
  return result
}
