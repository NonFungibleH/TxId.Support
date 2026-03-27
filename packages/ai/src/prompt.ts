import type { StreamChatParams } from "./types"

/**
 * Build the Claude system prompt from project config + runtime context.
 * Branches on mode: token mode gets a lightweight prompt without RAG.
 */
export function buildSystemPrompt(params: StreamChatParams): string {
  const { projectName, config, walletAddress, chainId, ragContext, mode, tokenModeAsk } = params
  const parts: string[] = []

  if (mode === "token") {
    // Token Mode: lightweight prompt, no RAG, no tx diagnostics
    parts.push(
      `You are a helpful assistant for ${projectName}. ` +
        `Answer questions about this project's token, community, and links. ` +
        `Be concise and friendly. If you don't know something, say so.`
    )

    if (config.token) {
      const t = config.token
      const lines = [`## Token`]
      if (t.symbol) lines.push(`Symbol: ${t.symbol}`)
      if (t.name)   lines.push(`Name: ${t.name}`)
      lines.push(`Address: \`${t.address}\``)
      if (t.dexUrl) lines.push(`Trade: ${t.dexUrl}`)
      parts.push(lines.join("\n"))
    }

    if (tokenModeAsk && tokenModeAsk.trim().length > 0) {
      parts.push(`## Project FAQ\n${tokenModeAsk.trim()}`)
    }

    parts.push(
      `## Instructions\n` +
        `- Keep responses under 150 words\n` +
        `- Direct buy/trade questions to the DEX link above\n` +
        `- Never fabricate contract addresses or prices`
    )
  } else {
    // Support Mode: full prompt with RAG, contracts, wallet context
    parts.push(
      `You are a support assistant for ${projectName}, a DeFi protocol. ` +
        `Be helpful, accurate, and concise. If you don't know something, say so clearly — never fabricate on-chain data.`
    )

    if (config.token) {
      const t = config.token
      const lines = [`## Token`, `Symbol: ${t.symbol ?? "unknown"}`, `Address: \`${t.address}\``]
      if (t.name)   lines.push(`Name: ${t.name}`)
      if (t.dexUrl) lines.push(`DEX: ${t.dexUrl}`)
      parts.push(lines.join("\n"))
    }

    if (config.watchedContracts && config.watchedContracts.length > 0) {
      const lines = ["## Smart Contracts"]
      for (const c of config.watchedContracts) {
        lines.push(`- **${c.name}** (\`${c.address}\` on chain ${c.chain}): ${c.description}`)
      }
      parts.push(lines.join("\n"))
    }

    if (walletAddress) {
      const lines = [`## User's Connected Wallet`, `Address: \`${walletAddress}\``]
      if (chainId) lines.push(`Chain ID: ${chainId}`)
      parts.push(lines.join("\n"))
    }

    if (ragContext && ragContext.trim().length > 0) {
      parts.push(`## Documentation\n${ragContext}`)
    }

    parts.push(
      `## Instructions\n` +
        `- Keep responses concise (under 200 words) unless detailed technical explanation is needed\n` +
        `- Format addresses and hashes in \`code\` blocks\n` +
        `- Never invent contract data or transaction details — only reference what is provided above\n` +
        `- If asked about token price, direct users to the DEX link or a block explorer\n` +
        `- When a wallet is connected and the question is about that wallet, answer specifically for that address`
    )
  }

  return parts.join("\n\n")
}
