import type { StreamChatParams } from "./types"

/**
 * Build the Claude system prompt from project config + runtime context.
 * Injects watched contracts, token info, RAG docs, and wallet context.
 */
export function buildSystemPrompt(params: StreamChatParams): string {
  const { projectName, config, walletAddress, chainId, ragContext } = params
  const parts: string[] = []

  parts.push(
    `You are a support assistant for ${projectName}, a DeFi protocol. ` +
      `Be helpful, accurate, and concise. If you don't know something, say so clearly — never fabricate on-chain data.`,
  )

  // Token context
  if (config.token) {
    const t = config.token
    const lines = [`## Token`, `Symbol: ${t.symbol ?? "unknown"}`, `Address: \`${t.address}\``]
    if (t.name) lines.push(`Name: ${t.name}`)
    if (t.dexUrl) lines.push(`DEX: ${t.dexUrl}`)
    parts.push(lines.join("\n"))
  }

  // Watched smart contracts
  if (config.watchedContracts && config.watchedContracts.length > 0) {
    const lines = ["## Smart Contracts"]
    for (const c of config.watchedContracts) {
      lines.push(`- **${c.name}** (\`${c.address}\` on chain ${c.chain}): ${c.description}`)
    }
    parts.push(lines.join("\n"))
  }

  // Connected wallet context
  if (walletAddress) {
    const lines = [`## User's Connected Wallet`, `Address: \`${walletAddress}\``]
    if (chainId) lines.push(`Chain ID: ${chainId}`)
    parts.push(lines.join("\n"))
  }

  // RAG documentation context
  if (ragContext && ragContext.trim().length > 0) {
    parts.push(`## Documentation\n${ragContext}`)
  }

  // Behavioural instructions
  parts.push(
    `## Instructions\n` +
      `- Keep responses concise (under 200 words) unless detailed technical explanation is needed\n` +
      `- Format addresses and hashes in \`code\` blocks\n` +
      `- Never invent contract data or transaction details — only reference what is provided above\n` +
      `- If asked about token price, direct users to the DEX link or a block explorer\n` +
      `- When a wallet is connected and the question is about that wallet, answer specifically for that address`,
  )

  return parts.join("\n\n")
}
