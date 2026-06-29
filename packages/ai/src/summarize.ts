import Anthropic from "@anthropic-ai/sdk"

let _client: Anthropic | null = null
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export async function summarizeConversation(
  messages: Array<{ role: string; content: string }>,
): Promise<string> {
  if (messages.length === 0) return ""
  const client = getClient()
  if (!client) return ""

  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Support bot"}: ${m.content}`)
    .join("\n")

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    messages: [
      {
        role: "user",
        content: `Summarise this crypto support conversation in one sentence (max 20 words). Focus on what the user needed and whether it was resolved.\n\n${transcript}`,
      },
    ],
  })

  return response.content[0]?.type === "text" ? response.content[0].text.trim() : ""
}
