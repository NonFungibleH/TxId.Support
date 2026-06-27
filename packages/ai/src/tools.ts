/**
 * Claude tool definitions and executor for live blockchain data access.
 *
 * Tools are only offered to Claude when a wallet address is known.
 * Claude decides which tools to call based on the user's question —
 * no keyword heuristics, no pre-fetching.
 */

import type Anthropic from "@anthropic-ai/sdk"
import {
  getNativeBalance,
  getTokenBalances,
  getRecentTransactions,
  getTransactionByHash,
} from "@txid/blockchain"
import type { WatchedContractSnapshot } from "./types"

export interface WalletConfig {
  address: string
  chainId: string
}

/**
 * Build the tool schema array to pass to Claude.
 * Includes watched contract addresses as hints in the description so Claude
 * knows to filter `get_recent_transactions` to relevant contracts.
 */
export function buildWalletTools(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool[] {
  const contractHint =
    watchedContracts.length > 0
      ? ` This protocol's contracts are: ${watchedContracts.map((c) => `${c.name} at ${c.address}`).join(", ")}. Use the contract_address filter when diagnosing a specific interaction.`
      : ""

  return [
    {
      name: "get_wallet_balance",
      description:
        "Get the current native currency (ETH, BNB, MATIC, etc.) and ERC-20 token balances " +
        "for the connected wallet. Use when the user asks about their balance, holdings, " +
        "funds, or how much of a token they have.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "get_recent_transactions",
      description:
        "Get the recent transaction history for the connected wallet. " +
        "Use this proactively whenever the user mentions anything going wrong or asks if something worked — " +
        "do NOT ask the user for a transaction hash, look it up yourself. " +
        "If the relevant protocol contract address is known, pass it as contract_address to filter results." +
        contractHint,
      input_schema: {
        type: "object" as const,
        properties: {
          limit: {
            type: "number",
            description: "Number of transactions to retrieve. Default 10, max 20.",
          },
          contract_address: {
            type: "string",
            description:
              "Filter to transactions interacting with this contract address. " +
              "Use the protocol's known contract addresses from the system context whenever relevant.",
          },
        },
        required: [],
      },
    },
    {
      name: "get_transaction_by_hash",
      description:
        "Look up the full details of a specific transaction by its hash. " +
        "Use when the user provides a transaction hash (0x...) or refers to a specific transaction.",
      input_schema: {
        type: "object" as const,
        properties: {
          hash: {
            type: "string",
            description: "The transaction hash (0x...)",
          },
        },
        required: ["hash"],
      },
    },
  ]
}

/**
 * Execute a tool call from Claude, fetching the requested blockchain data from Moralis.
 * Returns raw structured data — Claude interprets and presents it naturally.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  wallet: WalletConfig,
): Promise<unknown> {
  switch (name) {
    case "get_wallet_balance": {
      const [native, tokens] = await Promise.all([
        getNativeBalance(wallet.address, wallet.chainId),
        getTokenBalances(wallet.address, wallet.chainId).catch(() => []),
      ])
      return {
        address: wallet.address,
        native,
        tokens: tokens.slice(0, 20),
      }
    }

    case "get_recent_transactions": {
      const limit = Math.min(Number(input.limit ?? 10), 20)
      const contractAddress =
        typeof input.contract_address === "string" ? input.contract_address : undefined

      let txs = await getRecentTransactions(wallet.address, wallet.chainId, limit)

      if (contractAddress) {
        txs = txs.filter(
          (tx) => tx.to?.toLowerCase() === contractAddress.toLowerCase(),
        )
      }

      return txs
    }

    case "get_transaction_by_hash": {
      const hash = input.hash
      if (typeof hash !== "string" || !hash) {
        throw new Error("hash is required and must be a string")
      }
      return getTransactionByHash(hash, wallet.chainId)
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

/**
 * Escalation tool — always offered, not wallet-gated.
 * When Claude calls this, the widget intercepts it and shows a ticket form
 * (name + email) instead of executing it server-side.
 */
export function buildEscalationTool(): Anthropic.Tool {
  return {
    name: "create_support_ticket",
    description:
      "Create a support ticket when the issue cannot be resolved through this chat. Use this when:\n" +
      "- You have genuinely tried to help but cannot resolve the issue (no relevant documentation, requires account access, etc.)\n" +
      "- The user explicitly asks to speak to a human, raise a ticket, or contact support\n" +
      "- The issue is urgent or involves billing/account problems\n\n" +
      "Do NOT use this just because you are uncertain. Try to answer first. Only escalate when you truly cannot help.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: {
          type: "string",
          description: "A concise 1–2 sentence summary of the user's issue. Shown to the user when confirming their ticket.",
        },
        reason: {
          type: "string",
          enum: ["unresolved", "user_requested", "account_issue", "billing", "urgent"],
          description: "Why escalation is needed.",
        },
      },
      required: ["summary", "reason"],
    },
  }
}

/** Human-readable labels shown in the widget while Claude is using a tool */
export const TOOL_LABELS: Record<string, string> = {
  get_wallet_balance: "Checking your balance…",
  get_recent_transactions: "Looking up your transactions…",
  get_transaction_by_hash: "Fetching transaction details…",
}
