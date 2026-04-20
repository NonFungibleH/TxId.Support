import OpenAI from "openai"
import type { ChatMessage } from "./types"

const MODEL = "llama-3.3-70b-versatile"

let _client: OpenAI | null = null

function getClient(): OpenAI {
  if (!_client) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error("GROQ_API_KEY is not set")
    _client = new OpenAI({
      apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    })
  }
  return _client
}

/**
 * Stream a chat response as an async generator of text chunks.
 * Uses Groq (Llama 3.3 70B) — free tier, no API key cost.
 */
export async function* streamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 1024,
): AsyncGenerator<string> {
  const client = getClient()

  const stream = await client.chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ],
    stream: true,
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield text
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
