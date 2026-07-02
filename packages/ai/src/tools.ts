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
  getContractTransactions,
} from "@txid/blockchain"
import type { WatchedContractSnapshot } from "./types"

export interface WalletConfig {
  address: string
  chainId: string
}

/**
 * Build balance + history tools — only offered when a wallet is connected.
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
  ]
}

/**
 * Tx hash lookup — always offered, even without a connected wallet.
 * Requires chain_id when no wallet is connected so we know which network to query.
 */
export function buildTxLookupTool(): Anthropic.Tool {
  return {
    name: "get_transaction_by_hash",
    description:
      "Look up the full details of a specific transaction by its hash. " +
      "Use when the user provides a transaction hash (0x...) or refers to a specific transaction. " +
      "If the user's wallet is not connected, you must include chain_id — ask the user which network the transaction is on if you don't know.",
    input_schema: {
      type: "object" as const,
      properties: {
        hash: {
          type: "string",
          description: "The transaction hash (0x...)",
        },
        chain_id: {
          type: "string",
          description:
            "The chain ID for the network this transaction is on (e.g. '0x38' for BNB Chain, '0x1' for Ethereum, '0x2105' for Base). " +
            "Required when no wallet is connected. If the wallet is connected this defaults to the connected network.",
        },
      },
      required: ["hash"],
    },
  }
}

/**
 * Execute a tool call from Claude, fetching the requested blockchain data from Moralis.
 * Returns raw structured data — Claude interprets and presents it naturally.
 * wallet may be null when only the escalation or tx-hash tool is being called.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
  wallet: WalletConfig | null,
  watchedContracts: WatchedContractSnapshot[] = [],
): Promise<unknown> {
  switch (name) {
    case "get_wallet_balance": {
      if (!wallet) throw new Error("Wallet not connected")
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
      if (!wallet) throw new Error("Wallet not connected")
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
      // Prefer the connected wallet's chain; fall back to the chain_id the AI supplied
      const chainId =
        wallet?.chainId ??
        (typeof input.chain_id === "string" ? input.chain_id : undefined)
      if (!chainId) {
        throw new Error("Cannot look up transaction: no wallet connected and no chain_id provided")
      }
      // Build address→ABI map from watched contracts that have a stored ABI
      const knownAbis: Record<string, string> = {}
      for (const c of watchedContracts) {
        if (c.abi) knownAbis[c.address.toLowerCase()] = c.abi
      }
      return getTransactionByHash(hash, chainId, knownAbis)
    }

    case "get_contract_transactions": {
      const contractAddress = input.contract_address
      if (typeof contractAddress !== "string" || !contractAddress) {
        throw new Error("contract_address is required")
      }
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? "0x1")
      const limit = Math.min(Number(input.limit ?? 10), 20)
      return getContractTransactions(contractAddress, chainId, limit)
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

/**
 * Contract-level transaction lookup — always offered when watched contracts are configured.
 * Lets Claude find recent transactions on a protocol contract without needing a wallet
 * connection or a specific tx hash from the user.
 * Claude should follow up with get_transaction_by_hash on any failed tx it finds here
 * to get the full revert decode.
 */
export function buildContractTxsTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  if (watchedContracts.length === 0) return null
  const contractList = watchedContracts
    .map(c => `${c.name} at ${c.address} (chain ${c.chain})`)
    .join(", ")
  return {
    name: "get_contract_transactions",
    description:
      "Look up recent transactions sent to one of the protocol's smart contracts. " +
      "Use this PROACTIVELY when a user reports a transaction problem but hasn't connected their wallet — " +
      "you can find their likely transaction without asking them for anything technical. " +
      "After finding a failed transaction, call get_transaction_by_hash with its hash for a full error diagnosis. " +
      `This protocol's contracts: ${contractList}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: {
          type: "string",
          description: "The contract address to fetch transactions for. Use the relevant contract from the list above.",
        },
        chain_id: {
          type: "string",
          description: "The chain ID for the contract's network (e.g. '0x38' for BNB Chain, '0x1' for Ethereum).",
        },
        limit: {
          type: "number",
          description: "Number of recent transactions to fetch. Default 10, max 20.",
        },
      },
      required: ["contract_address", "chain_id"],
    },
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
          description:
            "A concise 1–2 sentence description of the user's issue, written in plain English directly for the user to read — NOT internal diagnostic notes. " +
            "Write as if confirming their issue to them: empathetic, user-facing, no technical jargon, no mention of what you tried internally. " +
            "Example (good): 'Your token lock transactions on BNB Chain are failing — our team will investigate what's preventing them from going through.' " +
            "Example (bad): 'User's three lock transactions failed with gas/revert errors. Need to investigate wallet state and contract interactions.'",
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
  get_transaction_by_hash: "Diagnosing transaction…",
  get_contract_transactions: "Checking contract activity…",
}
