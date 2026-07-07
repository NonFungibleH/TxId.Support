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
        'Give 2–3 short follow-up questions I might ask next that THIS assistant can actually answer. ' +
        'Return ONLY a JSON array of strings, ≤7 words each. Example: ["What caused this?","When was it deployed?","How do I retry?"]',
    },
  ]

  // Only suggest questions within the assistant's real capabilities, so every
  // chip leads to a good answer instead of "I can't do that".
  const capabilityGuide =
    "You suggest follow-up questions for a DeFi protocol support assistant. " +
    "Only suggest questions it can ACTUALLY answer. It CAN: answer from the protocol's documentation (features, fees, how-to, staking, unlocking); " +
    "diagnose a transaction when the user pastes its hash; and for the protocol's own contracts look up the deployment date, event history " +
    "(e.g. when fees changed), token holdings / how much is locked, recent activity, and the current value of simple on-chain settings. " +
    "It CANNOT: discuss other protocols, give price predictions, access off-chain/account data, or answer about contracts it doesn't track. " +
    "Never suggest a question it cannot answer. Return ONLY a valid JSON array of 2–3 short strings (≤7 words each), no markdown, no preamble."

  try {
    // 5-second timeout — suggestions are a nice-to-have; never stall stream close
    const raw = await Promise.race([
      completeChat(
        capabilityGuide,
        suggestionMessages,
        80,
      ),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("suggestions timeout")), 5000),
      ),
    ])
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
