/**
 * Intent detection and context formatting for blockchain data.
 * Used by the chat API to decide when to fetch transaction history
 * and by the system prompt builder to format wallet/tx context.
 */

// Keywords that suggest the user is asking about a transaction or wallet activity
const TX_INTENT_KEYWORDS = [
  "transaction", "tx", "txn",
  "failed", "fail", "failure", "revert", "reverted", "error",
  "pending", "stuck", "drop", "dropped",
  "gas", "out of gas",
  "hash",
  "swap", "approve", "approval",
  "lock", "unlock", "stake", "unstake", "bond",
  "bridge", "transfer", "sent", "received",
  "receipt", "confirm", "confirmed",
  "why did", "what happened", "check my",
  "didn't work", "not working",
]

/**
 * Returns true if the user's message likely relates to a blockchain transaction.
 * Used to decide whether to fetch getRecentTransactions() on the server.
 */
export function isTxQuery(message: string): boolean {
  const lower = message.toLowerCase()
  return TX_INTENT_KEYWORDS.some((kw) => lower.includes(kw))
}

/**
 * Format pre-fetched wallet balance data as a markdown context block.
 * Called by the /api/wallet-context route and included in the system prompt.
 */
export function formatWalletContext(
  address: string,
  chainName: string,
  nativeSymbol: string,
  nativeBalance: string,
  tokens: Array<{
    symbol: string
    name: string
    balanceFormatted: string
    usdValue: string | null
  }>,
): string {
  const lines = [
    `## Wallet Balances (pre-fetched at session start)`,
    `Address: \`${address}\``,
    `Chain: ${chainName}`,
    ``,
    `**Native balance:** ${nativeBalance} ${nativeSymbol}`,
  ]

  if (tokens.length > 0) {
    lines.push(``, `**Token holdings:**`)
    for (const t of tokens.slice(0, 15)) {
      const usd = t.usdValue ? ` ≈ ${t.usdValue}` : ""
      lines.push(`- ${t.balanceFormatted} ${t.symbol} (${t.name})${usd}`)
    }
  } else {
    lines.push(``, `No ERC-20 token balances found on this chain.`)
  }

  lines.push(
    ``,
    `This balance data was fetched when the user connected their wallet. ` +
    `Use it to answer balance questions accurately. ` +
    `For live/real-time data, direct the user to check a block explorer.`,
  )

  return lines.join("\n")
}

/**
 * Format recent transactions as a markdown context block.
 * Appended to the system prompt when a transaction-related query is detected.
 */
export function formatTransactionContext(
  transactions: Array<{
    hash: string
    timestamp: string
    status: "success" | "failed"
    summary: string
    gasUsed: string
    value: string
    from: string
    to: string | null
  }>,
): string {
  if (transactions.length === 0) return ""

  const lines = [`## Recent Transactions (last ${transactions.length})`]

  for (const tx of transactions) {
    let dateStr: string
    try {
      dateStr = new Date(tx.timestamp).toLocaleString("en-US", {
        dateStyle: "short",
        timeStyle: "short",
      })
    } catch {
      dateStr = tx.timestamp
    }
    const statusIcon = tx.status === "success" ? "✅" : "❌"
    lines.push(``)
    lines.push(`${statusIcon} **${tx.status.toUpperCase()}** — ${dateStr}`)
    lines.push(`Hash: \`${tx.hash}\``)
    lines.push(tx.summary)
    lines.push(`Gas used: ${parseInt(tx.gasUsed || "0").toLocaleString()}`)
  }

  lines.push(
    ``,
    `Use this transaction history to diagnose issues. ` +
    `For failed transactions, explain the most likely cause ` +
    `(insufficient gas, reverted contract call, slippage exceeded, etc.) ` +
    `and what the user should do next.`,
  )

  return lines.join("\n")
}
