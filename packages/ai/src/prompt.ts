import type { StreamChatParams } from "./types"

const CHAIN_NAMES: Record<string, string> = {
  "0x1":      "Ethereum Mainnet",
  "0x38":     "BNB Chain",
  "0x89":     "Polygon",
  "0xa":      "Optimism",
  "0xa4b1":   "Arbitrum One",
  "0x2105":   "Base",
  "0xe708":   "Linea",
  "0xaa36a7": "Sepolia (testnet)",
  "0x13881":  "Mumbai (testnet)",
  "0x14a34":  "Base Sepolia (testnet)",
  // decimal string variants
  "1":        "Ethereum Mainnet",
  "56":       "BNB Chain",
  "137":      "Polygon",
  "10":       "Optimism",
  "42161":    "Arbitrum One",
  "8453":     "Base",
  "59144":    "Linea",
  "11155111": "Sepolia (testnet)",
  "80001":    "Mumbai (testnet)",
  "84532":    "Base Sepolia (testnet)",
}

function chainName(chainId: string): string {
  const key = chainId.toLowerCase()
  return CHAIN_NAMES[key] ?? chainId
}

/**
 * Build the system prompt from project config + runtime context.
 * Branches on mode: token mode gets a lightweight prompt without RAG.
 *
 * For support mode, if a walletConfig is provided Claude also receives
 * blockchain tools (get_wallet_balance, get_recent_transactions,
 * get_transaction_by_hash) — it decides what to fetch based on the question.
 */
export function buildSystemPrompt(params: StreamChatParams): string {
  const { projectName, config, walletConfig, ragContext, mode, tokenModeAsk } = params
  const parts: string[] = []

  if (mode === "token") {
    // ── Token Mode: lightweight, FAQ-driven ───────────────────────────────────
    parts.push(
      `You are a knowledgeable community member and supporter of ${projectName}. ` +
      `You know this project inside and out. Answer questions confidently and helpfully. ` +
      `Be friendly, clear, and direct — like a team member talking to a community member.`
    )

    if (config.token) {
      const t = config.token
      const lines = [`## Token Details`]
      if (t.symbol) lines.push(`Symbol: ${t.symbol}`)
      if (t.name)   lines.push(`Name: ${t.name}`)
      lines.push(`Contract address: \`${t.address}\``)
      if (t.dexUrl) lines.push(`Trade on DEX: ${t.dexUrl}`)
      parts.push(lines.join("\n"))
    }

    if (tokenModeAsk && tokenModeAsk.trim().length > 0) {
      parts.push(`## Project Information\n${tokenModeAsk.trim()}`)
    }

    parts.push(
      `## How to respond\n` +
      `- Be conversational and friendly — you're part of the team\n` +
      `- For buy/sell questions, send users to the DEX link above\n` +
      `- Never make up contract addresses, prices, or data you don't have\n` +
      `- If you genuinely don't know something, say you'll pass it along to the team`
    )

  } else {
    // ── Support Mode: RAG + contracts + live blockchain tools ─────────────────
    parts.push(
      `You are a senior support specialist for ${projectName}, a DeFi protocol. ` +
      `You have deep knowledge of this protocol — its features, smart contracts, tokenomics, and common user issues. ` +
      `Respond as a knowledgeable team member would: confident, helpful, and specific. ` +
      `Draw on the documentation and context provided below to give accurate, detailed answers. ` +
      `Never fabricate on-chain data, contract addresses, or transaction details.`
    )

    if (config.token) {
      const t = config.token
      const lines = [`## Protocol Token`]
      if (t.symbol) lines.push(`Symbol: ${t.symbol}`)
      if (t.name)   lines.push(`Name: ${t.name}`)
      lines.push(`Contract: \`${t.address}\``)
      if (t.dexUrl) lines.push(`Trade: ${t.dexUrl}`)
      parts.push(lines.join("\n"))
    }

    if (config.watchedContracts && config.watchedContracts.length > 0) {
      const lines = ["## Smart Contracts"]
      for (const c of config.watchedContracts) {
        lines.push(`- **${c.name}** (\`${c.address}\` on chain ${c.chain}): ${c.description}`)
      }
      parts.push(lines.join("\n"))
    }

    if (walletConfig) {
      // Wallet is connected — tools are available
      parts.push(
        `## User's Wallet\n` +
        `Address: \`${walletConfig.address}\`\n` +
        `Network: ${chainName(walletConfig.chainId)}\n\n` +
        `Live blockchain tools are available. Use them ONLY to diagnose a specific transaction problem the user is describing — NOT for general protocol questions.\n\n` +
        `**Use tools when:**\n` +
        `- The user says a specific action failed or didn't complete ("my lock failed", "did my transfer go through", "something went wrong")\n` +
        `- The user explicitly asks about their balance\n\n` +
        `**Do NOT use tools when:**\n` +
        `- The user asks how the protocol works, what features it has, what things cost, or how to do something\n` +
        `- Questions about fees, pricing, functionality, or protocol behaviour — answer these from the documentation below\n\n` +
        `**When you do use tools:**\n` +
        `- Never ask the user for a transaction hash or any technical data — look it up yourself\n` +
        `- Find the relevant transaction yourself (most recent failed or relevant one). Never ask the user to identify it.\n` +
        `- If the protocol's contract address is known (Smart Contracts section), pass it as contract_address to filter results\n` +
        `- Diagnose in plain English: "the transaction ran out of gas fee" not "OOG error"; "wrong network" not "chainId mismatch"\n` +
        `- If gasUsed equals or nearly equals gasLimit on a failed tx, the cause is out-of-gas\n` +
        `- Do not tell the user to check a block explorer — you are the block explorer`
      )
    } else {
      // No wallet connected
      parts.push(
        `## User's Wallet\n` +
        `No wallet is connected for this session.\n\n` +
        `If the user describes a problem that needs their transaction history or balance ` +
        `(e.g. "my lock failed", "did my swap go through", "how much do I have"), ` +
        `ask them briefly and naturally to share their wallet address or connect via the Wallet tab. ` +
        `One sentence — don't make it feel like a barrier. ` +
        `Never ask for a "transaction hash" — users won't know what that is.`
      )
    }

    if (ragContext && ragContext.trim().length > 0) {
      parts.push(
        `## Protocol Documentation\n` +
        `The following is drawn directly from this protocol's documentation. ` +
        `Treat it as authoritative.\n\n` +
        ragContext.trim()
      )
    } else {
      parts.push(
        `## Documentation\n` +
        `No documentation excerpts matched this specific query. ` +
        `Answer from general DeFi knowledge and the protocol context above. ` +
        `Point users to the team's official docs for anything you cannot confirm.`
      )
    }

    parts.push(
      `## How to respond\n` +
      `- You are a senior support engineer. Act like one — look things up, don't ask the user for information you can fetch.\n` +
      `- Speak plain English. No jargon. If you must mention a technical term, explain it in parentheses.\n` +
      `- For any problem report: use your tools immediately, find what happened, explain it clearly, tell them exactly what to do.\n` +
      `- Match length to complexity: one sentence for simple questions, a clear step-by-step for problems.\n` +
      `- Format contract addresses and tx hashes in \`code\` blocks so users can copy them.\n` +
      `- If something isn't in the docs or tools, be honest and point to Discord / the team.\n` +
      `- Never invent token prices, APYs, or contract data.`
    )
  }

  return parts.join("\n\n")
}
