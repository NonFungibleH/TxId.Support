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
  diagnosePendingTx,
  getContractEvents,
  eventNamesFromAbi,
  getContractDeployment,
  getContractState,
  viewGetterNames,
  getContractData,
  viewFunctionsWithArgs,
  contractFunctions,
  getContractInfo,
  getUpgradeHistory,
  enrichTransaction,
  getTokenInfo,
  getTokenAllowance,
  getTokenPrice,
  getWalletApprovals,
} from "@txid/blockchain"
import {
  getSolanaWalletBalance,
  getSolanaRecentTransactions,
  getSolanaTransactionBySignature,
  isSolanaChain,
} from "@txid/solana"
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
        "Get the current native currency (ETH, BNB, SOL, etc.) and token balances " +
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
      name: "get_wallet_approvals",
      description:
        "List the ERC-20 token approvals the connected wallet has granted (which token, which spender, how much, whether unlimited). " +
        "Use for 'what have I approved', 'which approvals do I have', 'is my wallet safe', 'have I approved this protocol'. " +
        "Flag unlimited approvals as worth reviewing/revoking.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
  ]
}

/**
 * Tx hash lookup — always offered, even without a connected wallet.
 * The chain is auto-detected across the protocol's chains, so chain_id is only
 * an optional hint — never ask the user which chain the transaction is on.
 */
export function buildTxLookupTool(): Anthropic.Tool {
  return {
    name: "get_transaction_by_hash",
    description:
      "Look up the full details of a specific transaction by its hash or signature. " +
      "Use when the user provides a transaction hash (0x... for EVM) or signature (base58 for Solana), " +
      "or refers to a specific transaction. " +
      "The correct chain is detected automatically — do NOT ask the user which network it is on. " +
      "The result includes the chain the transaction was actually found on; if it includes checkedChains, it was not found on any of them.",
    input_schema: {
      type: "object" as const,
      properties: {
        hash: {
          type: "string",
          description: "The transaction hash (0x... for EVM chains) or signature (base58 string for Solana)",
        },
        chain_id: {
          type: "string",
          description:
            "OPTIONAL hint only. If the user explicitly names a chain (e.g. '0x2105' for Base), pass it to prioritise that chain. " +
            "The tool still auto-detects the correct chain, so never ask the user for this.",
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
  const solana = wallet ? isSolanaChain(wallet.chainId) : false

  switch (name) {
    case "get_wallet_balance": {
      if (!wallet) throw new Error("Wallet not connected")
      if (solana) {
        return getSolanaWalletBalance(wallet.address)
      }
      const [native, tokens] = await Promise.all([
        getNativeBalance(wallet.address, wallet.chainId),
        getTokenBalances(wallet.address, wallet.chainId).catch(() => []),
      ])
      return { address: wallet.address, native, tokens: tokens.slice(0, 20) }
    }

    case "get_recent_transactions": {
      if (!wallet) throw new Error("Wallet not connected")
      const limit = Math.min(Number(input.limit ?? 10), 20)
      const programOrContract =
        typeof input.contract_address === "string" ? input.contract_address : undefined

      if (solana) {
        return getSolanaRecentTransactions(wallet.address, programOrContract, limit)
      }

      let txs = await getRecentTransactions(wallet.address, wallet.chainId, limit)
      if (programOrContract) {
        txs = txs.filter(tx => tx.to?.toLowerCase() === programOrContract.toLowerCase())
      }
      return txs
    }

    case "get_wallet_approvals": {
      if (!wallet) throw new Error("Wallet not connected")
      if (solana) return { approvals: [], note: "Approval listing is EVM-only." }
      const approvals = await getWalletApprovals(wallet.address, wallet.chainId)
      return { address: wallet.address, count: approvals.length, approvals }
    }

    case "get_transaction_by_hash": {
      const hash = input.hash
      if (typeof hash !== "string" || !hash) {
        throw new Error("hash is required and must be a string")
      }
      const providedChain = typeof input.chain_id === "string" ? input.chain_id : undefined

      // Solana signatures are base58 (no 0x). Route to Solana when the hash is
      // not an EVM hash and the project/wallet is Solana.
      const looksEvm = /^0x[0-9a-fA-F]{64}$/.test(hash)
      const solanaInPlay =
        isSolanaChain(providedChain ?? "") ||
        isSolanaChain(wallet?.chainId ?? "") ||
        watchedContracts.some(c => isSolanaChain(c.chain))
      if (!looksEvm && solanaInPlay) {
        return getSolanaTransactionBySignature(hash)
      }

      // Never assume the chain: search every relevant EVM chain for the hash and
      // use whichever one actually has it. Candidates in priority order:
      // the chain the user named, the connected wallet's chain, then the chains
      // this protocol's contracts live on.
      const candidates: string[] = []
      const pushEvm = (c?: string) => {
        if (c && !isSolanaChain(c) && !candidates.includes(c)) candidates.push(c)
      }
      pushEvm(providedChain)
      pushEvm(wallet?.chainId ?? undefined)
      for (const c of watchedContracts) pushEvm(c.chain)
      if (candidates.length === 0) pushEvm("0x1")

      const knownAbis: Record<string, string> = {}
      for (const c of watchedContracts) {
        if (c.abi) knownAbis[c.address.toLowerCase()] = c.abi
      }

      // Look on all candidate chains at once; take the highest-priority hit.
      const results = await Promise.all(
        candidates.map(async chainId => ({
          chainId,
          tx: await getTransactionByHash(hash, chainId, knownAbis).catch(() => null),
        })),
      )
      const hit = results.find(r => r.tx)
      if (hit?.tx) {
        const tx = hit.tx
        // Scope guard: only diagnose transactions to THIS protocol's own contracts.
        if (watchedContracts.length > 0 && tx.to) {
          const isOwn = watchedContracts.some(c => c.address.toLowerCase() === tx.to!.toLowerCase())
          if (!isOwn) {
            return {
              hash,
              chainId: hit.chainId,
              status: "out_of_scope",
              to: tx.to,
              note: "This transaction is not to one of this protocol's own contracts, so it is outside what you can diagnose. Do NOT analyse it — decline in one sentence and offer to help with this protocol's own transactions.",
            }
          }
        }
        // Enrich the mined tx with decoded args, EVERY event (decoded against all
        // known ABIs + standard events + 4byte fallback), token transfers, gas
        // verdict and confirmations (once, on the chain it was found on).
        const enrichment = await enrichTransaction(hash, hit.chainId, Object.values(knownAbis)).catch(() => null)
        return enrichment ? { ...tx, ...enrichment } : tx
      }

      // Not mined on any candidate chain — diagnose pending/dropped on the most
      // likely chain, and report exactly which chains were checked.
      const diagChain = candidates[0]!
      const pendingDiagnosis = await diagnosePendingTx(hash, diagChain, wallet?.address).catch(() => null)
      if (pendingDiagnosis) {
        return { hash, chainId: diagChain, status: "not_mined", pendingDiagnosis, checkedChains: candidates }
      }
      return {
        hash,
        status: "not_found",
        checkedChains: candidates,
        note: `This transaction was not found on any of the chains checked (${candidates.join(", ")}). Do not claim it is on, or dropped from, a specific chain — state which chains were checked.`,
      }
    }

    case "get_contract_transactions": {
      const contractAddress = input.contract_address
      if (typeof contractAddress !== "string" || !contractAddress) {
        throw new Error("contract_address is required")
      }
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? "0x1")
      const limit = Math.min(Number(input.limit ?? 10), 20)
      if (isSolanaChain(chainId)) {
        // For Solana, treat contract_address as a program address and fetch recent txs
        return getSolanaRecentTransactions(contractAddress, contractAddress, limit)
      }
      return getContractTransactions(contractAddress, chainId, limit)
    }

    case "get_contract_events": {
      const eventName = typeof input.event_name === "string" ? input.event_name : ""
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      if (!eventName) throw new Error("event_name is required")
      const target = contractAddress
        ? watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
        : watchedContracts.length === 1 ? watchedContracts[0] : undefined
      if (!target) throw new Error("Specify which contract (contract_address) to read events from")
      if (isSolanaChain(target.chain)) {
        return { events: [], note: "Event history lookups are only available on EVM chains." }
      }
      const events = await getContractEvents(target.address, target.chain, eventName, target.abi ?? undefined)
      return { contract: target.name, event: eventName, count: events.length, events }
    }

    case "get_contract_deployment": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const target = contractAddress
        ? watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
        : watchedContracts.length === 1 ? watchedContracts[0] : undefined
      if (!target) throw new Error("Specify which contract (contract_address) to look up")
      if (isSolanaChain(target.chain)) {
        return { note: "Deployment lookup is only available on EVM chains." }
      }
      const deployment = await getContractDeployment(target.address, target.chain)
      return deployment
        ? { contract: target.name, ...deployment }
        : { contract: target.name, note: "Deployment details could not be retrieved." }
    }

    case "get_contract_holdings": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const target = contractAddress
        ? watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
        : watchedContracts.length === 1 ? watchedContracts[0] : undefined
      if (!target) throw new Error("Specify which contract (contract_address) to check holdings for")
      if (isSolanaChain(target.chain)) {
        return getSolanaWalletBalance(target.address)
      }
      const [native, tokens] = await Promise.all([
        getNativeBalance(target.address, target.chain),
        getTokenBalances(target.address, target.chain).catch(() => []),
      ])
      return { contract: target.name, address: target.address, native, tokens: tokens.slice(0, 30) }
    }

    case "get_contract_state": {
      const functionName = typeof input.function_name === "string" ? input.function_name : ""
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      if (!functionName) throw new Error("function_name is required")
      const target = contractAddress
        ? watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
        : watchedContracts.length === 1 ? watchedContracts[0] : undefined
      if (!target) throw new Error("Specify which contract (contract_address) to read")
      if (isSolanaChain(target.chain)) {
        return { note: "Reading contract state is only available on EVM chains." }
      }
      const state = await getContractState(target.address, target.chain, functionName, target.abi ?? undefined)
      return state
        ? { contract: target.name, ...state }
        : { contract: target.name, function: functionName, note: "That value is not a readable no-argument getter on this contract, or the read failed." }
    }

    case "get_contract_data": {
      const functionName = typeof input.function_name === "string" ? input.function_name : ""
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const args = Array.isArray(input.args) ? input.args.map(a => String(a)) : []
      if (!functionName) throw new Error("function_name is required")
      const target = contractAddress
        ? watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
        : watchedContracts.length === 1 ? watchedContracts[0] : undefined
      if (!target) throw new Error("Specify which contract (contract_address) to read")
      if (isSolanaChain(target.chain)) {
        return { note: "Reading contract data is only available on EVM chains." }
      }
      const data = await getContractData(target.address, target.chain, functionName, args, target.abi ?? undefined)
      return data
        ? { contract: target.name, ...data }
        : { contract: target.name, function: functionName, note: "Could not read that function — it may take unsupported argument types, not be a view function, or have reverted." }
    }

    case "get_contract_info": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const target = contractAddress
        ? watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
        : watchedContracts.length === 1 ? watchedContracts[0] : undefined
      if (!target) throw new Error("Specify which contract (contract_address) to look up")
      if (isSolanaChain(target.chain)) {
        return { note: "Verification/proxy info is only available on EVM chains." }
      }
      const info = await getContractInfo(target.address, target.chain)
      return info ? { contract: target.name, ...info } : { contract: target.name, note: "Verification info could not be retrieved." }
    }

    case "get_contract_functions": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const target = contractAddress
        ? watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
        : watchedContracts.length === 1 ? watchedContracts[0] : undefined
      if (!target) throw new Error("Specify which contract (contract_address)")
      const fns = contractFunctions(target.abi ?? undefined)
      return { contract: target.name, readFunctions: fns.read, writeFunctions: fns.write }
    }

    case "get_upgrade_history": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const target = contractAddress
        ? watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
        : watchedContracts.length === 1 ? watchedContracts[0] : undefined
      if (!target) throw new Error("Specify which contract (contract_address)")
      if (isSolanaChain(target.chain)) {
        return { upgrades: [], note: "Upgrade history is only available on EVM chains." }
      }
      const upgrades = await getUpgradeHistory(target.address, target.chain)
      return { contract: target.name, count: upgrades.length, upgrades }
    }

    case "get_token_info": {
      const token = typeof input.token_address === "string" ? input.token_address : undefined
      if (!token) throw new Error("token_address is required")
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? watchedContracts[0]?.chain ?? "0x1")
      if (isSolanaChain(chainId)) return { note: "Token reads here are EVM-only." }
      const info = await getTokenInfo(token, chainId)
      return info ?? { token, note: "Could not read token details (not an ERC-20, or the read failed)." }
    }

    case "get_token_allowance": {
      const token = typeof input.token_address === "string" ? input.token_address : undefined
      const owner = typeof input.owner === "string" ? input.owner : wallet?.address
      const spender = typeof input.spender === "string" ? input.spender : undefined
      if (!token || !owner || !spender) throw new Error("token_address, owner and spender are required")
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? watchedContracts[0]?.chain ?? "0x1")
      if (isSolanaChain(chainId)) return { note: "Allowance reads here are EVM-only." }
      const allowance = await getTokenAllowance(token, owner, spender, chainId)
      return allowance ?? { token, owner, spender, note: "Could not read the allowance." }
    }

    case "get_token_price": {
      const token = typeof input.token_address === "string" ? input.token_address : undefined
      if (!token) throw new Error("token_address is required")
      const price = await getTokenPrice(token)
      return price ?? { token, note: "No price found — the token may have no liquid DEX pair." }
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
 * Contract event-history lookup — offered when a watched contract has an ABI
 * (needed to derive the event's topic0). Lets Claude answer "when did X happen"
 * / "how often" questions by reading the contract's on-chain event log.
 */
export function buildContractEventsTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  const withAbi = watchedContracts.filter(c => c.abi)
  if (withAbi.length === 0) return null
  const lines = withAbi
    .map(c => {
      const events = eventNamesFromAbi(c.abi).slice(0, 40)
      return `${c.name} at ${c.address} (chain ${c.chain}) — events: ${events.join(", ") || "none"}`
    })
    .join("; ")
  return {
    name: "get_contract_events",
    description:
      "Read the on-chain history of a specific EVENT emitted by one of the protocol's contracts, newest first. " +
      "Use this to answer questions about WHEN something happened or HOW OFTEN — e.g. 'when were fees last changed', " +
      "'when was the last deposit', 'how many times has X happened'. Returns each occurrence's block timestamp and transaction hash. " +
      `Available contracts and their events: ${lines}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: {
          type: "string",
          description: "The contract address to read events from (use one from the list above).",
        },
        event_name: {
          type: "string",
          description: "The exact event name to look up, e.g. 'FeesChanged' (choose from the events listed for that contract).",
        },
      },
      required: ["contract_address", "event_name"],
    },
  }
}

/**
 * Contract deployment lookup — offered when watched contracts exist. Answers
 * "when was the contract deployed / who created it / how old is it".
 */
export function buildContractDeploymentTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  if (watchedContracts.length === 0) return null
  const list = watchedContracts.map(c => `${c.name} at ${c.address} (chain ${c.chain})`).join(", ")
  return {
    name: "get_contract_deployment",
    description:
      "Look up WHEN one of the protocol's contracts was deployed (created) and who deployed it. " +
      "Use for questions like 'when was the contract deployed', 'how old is the contract', 'who created it'. " +
      "Returns the deployment timestamp, the deployer address, and the creation transaction hash. " +
      `This protocol's contracts: ${list}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: {
          type: "string",
          description: "The contract address to look up (use one from the list above).",
        },
      },
      required: ["contract_address"],
    },
  }
}

/**
 * Contract holdings lookup — offered when watched contracts exist. Answers
 * "how many tokens are locked / what does the contract hold" by reading the
 * contract's own native + ERC-20 balances.
 */
export function buildContractHoldingsTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  if (watchedContracts.length === 0) return null
  const list = watchedContracts.map(c => `${c.name} at ${c.address} (chain ${c.chain})`).join(", ")
  return {
    name: "get_contract_holdings",
    description:
      "Look up the tokens held BY one of the protocol's contracts — i.e. how many tokens are locked or custodied in it. " +
      "Use for 'how many tokens are locked', 'what does the contract hold', 'how much is in the contract', 'total value locked'. " +
      "Returns the contract's native balance and its ERC-20 token balances. " +
      `This protocol's contracts: ${list}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: {
          type: "string",
          description: "The contract address to check holdings for (use one from the list above).",
        },
      },
      required: ["contract_address"],
    },
  }
}

/**
 * Contract state reader — offered when a watched contract has an ABI. Reads the
 * current value of a no-argument view getter (fee, paused, owner, totalSupply…).
 */
export function buildContractStateTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  const withAbi = watchedContracts.filter(c => c.abi)
  if (withAbi.length === 0) return null
  const lines = withAbi
    .map(c => {
      const getters = viewGetterNames(c.abi).slice(0, 40)
      return `${c.name} at ${c.address} (chain ${c.chain}) — getters: ${getters.join(", ") || "none"}`
    })
    .join("; ")
  return {
    name: "get_contract_state",
    description:
      "Read the CURRENT value of a no-argument view getter on one of the protocol's contracts — e.g. the current fee, whether it's paused right now, the owner, a total, a limit. " +
      "Use for 'what is the current fee', 'is the contract paused', 'who owns it', 'what is the <setting>'. Pass the contract address and the exact getter name. " +
      `Available contracts and their getters: ${lines}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: {
          type: "string",
          description: "The contract address to read (use one from the list above).",
        },
        function_name: {
          type: "string",
          description: "The exact getter name to read, e.g. 'fee' or 'paused' (choose from the getters listed for that contract).",
        },
      },
      required: ["contract_address", "function_name"],
    },
  }
}

/**
 * Contract data reader WITH arguments — offered when a watched contract has an
 * ABI with argument-taking view functions (getUserLock(address), allowance,
 * balanceOf, locks(uint256)…). This answers "about my position" questions.
 */
export function buildContractDataTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  const withArgFns = watchedContracts
    .map(c => ({ c, fns: viewFunctionsWithArgs(c.abi) }))
    .filter(x => x.fns.length > 0)
  if (withArgFns.length === 0) return null
  const lines = withArgFns.map(({ c, fns }) => `${c.name} at ${c.address} (chain ${c.chain}) — functions: ${fns.slice(0, 30).join("; ")}`).join(" | ")
  return {
    name: "get_contract_data",
    description:
      "Call a view function that takes ARGUMENTS on one of the protocol's contracts and get the decoded result — e.g. a user's lock (getUserLock(address)), an allowance, a balanceOf, a lock by index. " +
      "Use for questions about a specific address or index, especially the connected wallet's own position. Pass contract_address, function_name, and args in the exact order the function expects (addresses as 0x…, numbers as strings). " +
      `Available contracts and their argument-taking functions: ${lines}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: { type: "string", description: "The contract address (from the list above)." },
        function_name: { type: "string", description: "The exact function name, e.g. 'getUserLock'." },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Arguments in order. Addresses as 0x…, numbers as decimal strings, booleans as 'true'/'false'.",
        },
      },
      required: ["contract_address", "function_name", "args"],
    },
  }
}

/**
 * Contract verification / proxy info + function catalogue + upgrade history.
 * Three lightweight tools offered whenever watched contracts exist.
 */
export function buildContractInfoTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  if (watchedContracts.length === 0) return null
  const list = watchedContracts.map(c => `${c.name} at ${c.address} (chain ${c.chain})`).join(", ")
  return {
    name: "get_contract_info",
    description:
      "Get whether a contract is verified, whether it is a proxy, its implementation address, contract name, and compiler. " +
      "Use for 'is this contract verified', 'is it a proxy', 'is it safe/audited-on-chain', 'what's the implementation'. " +
      `Contracts: ${list}.`,
    input_schema: {
      type: "object" as const,
      properties: { contract_address: { type: "string", description: "The contract address (from the list above)." } },
      required: ["contract_address"],
    },
  }
}

export function buildContractFunctionsTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  const withAbi = watchedContracts.filter(c => c.abi)
  if (withAbi.length === 0) return null
  const list = withAbi.map(c => `${c.name} at ${c.address}`).join(", ")
  return {
    name: "get_contract_functions",
    description:
      "List what a contract can do — its read (view) functions and write (state-changing) functions, from the ABI. " +
      "Use for 'what can this contract do', 'what functions does it have', 'how do I interact with it'. " +
      `Contracts: ${list}.`,
    input_schema: {
      type: "object" as const,
      properties: { contract_address: { type: "string", description: "The contract address (from the list above)." } },
      required: ["contract_address"],
    },
  }
}

export function buildUpgradeHistoryTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  if (watchedContracts.length === 0) return null
  const list = watchedContracts.map(c => `${c.name} at ${c.address} (chain ${c.chain})`).join(", ")
  return {
    name: "get_upgrade_history",
    description:
      "Get a proxy contract's implementation upgrade history (each Upgraded event: new implementation, date, tx). " +
      "Use for 'has this contract been upgraded', 'when was it last upgraded', 'implementation history'. " +
      `Contracts: ${list}.`,
    input_schema: {
      type: "object" as const,
      properties: { contract_address: { type: "string", description: "The contract address (from the list above)." } },
      required: ["contract_address"],
    },
  }
}

/** Token tools — work on any ERC-20 by address (standard interface), always offered. */
export function buildTokenTools(): Anthropic.Tool[] {
  return [
    {
      name: "get_token_info",
      description:
        "Read an ERC-20 token's name, symbol, decimals and total supply by address. " +
        "Use for 'what's the token supply', 'how many decimals', 'what's the symbol'. " +
        "Pass the protocol's token address (in the system context) or a token address the user names.",
      input_schema: {
        type: "object" as const,
        properties: {
          token_address: { type: "string", description: "The ERC-20 token contract address." },
          chain_id: { type: "string", description: "Optional chain ID; defaults to the connected wallet or the protocol's chain." },
        },
        required: ["token_address"],
      },
    },
    {
      name: "get_token_allowance",
      description:
        "Check how much of a token the owner has approved a spender to move — answers 'do I need to approve first?'. " +
        "For the connected wallet, owner defaults to it. spender is usually the protocol contract the user is interacting with. " +
        "Returns the allowance, whether it's unlimited, and whether an approval is still needed.",
      input_schema: {
        type: "object" as const,
        properties: {
          token_address: { type: "string", description: "The ERC-20 token address." },
          owner: { type: "string", description: "The wallet that would approve (defaults to the connected wallet)." },
          spender: { type: "string", description: "The contract that needs approval (e.g. the lock contract)." },
          chain_id: { type: "string", description: "Optional chain ID." },
        },
        required: ["token_address", "spender"],
      },
    },
    {
      name: "get_token_price",
      description:
        "Get a token's current USD price from DEX liquidity (DexScreener). Use for 'what's the price of <token>'. " +
        "Returns the price, the DEX/chain, and the pair's liquidity. Pass the token address.",
      input_schema: {
        type: "object" as const,
        properties: {
          token_address: { type: "string", description: "The token contract address." },
        },
        required: ["token_address"],
      },
    },
  ]
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
  get_wallet_approvals: "Checking your token approvals…",
  get_transaction_by_hash: "Diagnosing transaction…",
  get_contract_transactions: "Checking contract activity…",
  get_contract_events: "Reading contract event history…",
  get_contract_deployment: "Checking contract deployment…",
  get_contract_holdings: "Checking contract holdings…",
  get_contract_state: "Reading contract state…",
  get_contract_data: "Reading contract data…",
  get_contract_info: "Checking contract verification…",
  get_contract_functions: "Reading contract functions…",
  get_upgrade_history: "Checking upgrade history…",
  get_token_info: "Reading token details…",
  get_token_allowance: "Checking token approval…",
  get_token_price: "Checking token price…",
}
