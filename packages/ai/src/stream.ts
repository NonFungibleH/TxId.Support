import Anthropic from "@anthropic-ai/sdk"
import OpenAI from "openai"
import type { ChatMessage } from "./types"

// ── Model selection ──────────────────────────────────────────────────────────
// Prefer Claude Haiku (smarter, better instruction-following) when
// ANTHROPIC_API_KEY is available; fall back to Groq Llama 3.3 70B (free).

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

/**
 * Stream a chat response as an async generator of text chunks.
 * Uses Claude Haiku if ANTHROPIC_API_KEY is set, otherwise Groq Llama 3.3 70B.
 */
export async function* streamChat(
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens = 2048,
): AsyncGenerator<string> {
  const anthropic = getAnthropicClient()

  if (anthropic) {
    // ── Claude Haiku via Anthropic SDK ───────────────────────────────────────
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
    // ── Groq Llama 3.3 70B fallback ──────────────────────────────────────────
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
