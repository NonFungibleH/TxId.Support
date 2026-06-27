import type { ChatMessage } from "./types"
import { completeChat } from "./stream"

/**
 * Generate 2–3 short follow-up question suggestions based on the conversation
 * and the AI's last reply. Returns an empty array on any failure — non-fatal.
 */
export async function generateSuggestions(
  recentMessages: ChatMessage[],
  lastReply: string,
): Promise<string[]> {
  const ctx = recentMessages.slice(-4)

  const suggestionMessages: ChatMessage[] = [
    ...ctx,
    { role: "assistant", content: lastReply.slice(0, 600) },
    {
      role: "user",
      content:
        'Give 2–3 short follow-up questions I might ask next. Return ONLY a JSON array of strings, ≤7 words each. Example: ["What caused this?","Can I retry?","Is this normal?"]',
    },
  ]

  try {
    const raw = await completeChat(
      "Return ONLY a valid JSON array of 2–3 short follow-up question strings (≤7 words each). No explanation, no markdown, no preamble.",
      suggestionMessages,
      80,
    )
    const match = raw.trim().match(/\[[\s\S]*?\]/)
    if (!match) return []
    const parsed = JSON.parse(match[0]) as unknown
    if (!Array.isArray(parsed)) return []
    return (parsed as unknown[])
      .filter((s): s is string => typeof s === "string" && s.length > 0)
      .slice(0, 3)
      .map((s) => s.slice(0, 55))
  } catch {
    return []
  }
}
