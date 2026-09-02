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
  LookupUnavailableError,
  getContractTransactions,
  diagnosePendingTx,
  getContractEvents,
  canCheckEvent,
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
  getNativeTokenPrice,
  getWalletApprovals,
  getNetworkStatus,
  diagnoseWalletRpc,
  CHAIN_CONFIGS,
  checkSanctioned,
  getTokenSafety,
  resolveEnsName,
  estimateAction,

  canonicalChainId,
} from "@txid/blockchain"
import type { TokenBalance } from "@txid/blockchain"
import {
  getSolanaWalletBalance,
  getSolanaRecentTransactions,
  getSolanaTransactionBySignature,
  isSolanaChain,
} from "@txid/solana"
import {
  isAptosChain,
  isAptosAddress,
  normalizeAptosAddress,
  getAptosWalletBalance,
  getAptosRecentTransactions,
  getAptosRecentTransactionsMerged,
  getAptosTransactionByHash,
  getAptosAssetMetadata,
  getAptosModuleAbi,
  getAptosDeployment,
  getAptosAssetActivities,
  getAptosModuleEvents,
  getAptosTokenSafety,
  adapterFor,
  marketsInArguments,
  getProtocolAccount,
  getProtocolMarkets,
  resolveProtocolAccountAddress,
  getAptosDelegations,
  getAptosStakingActivity,
  getAptosPoolLockup,
  getAptosNfts,
  getAptosPendingNftClaims,
  getAptosObject,
  getAptosAuthKeyStatus,
  simulateAptosEntryFunction,
  getAptosPackages,
  viewFunction,
  getAptosNetworkStatus,
  diagnoseAptosWallet,
  resolveAptosName,
  errmapFor,
  type AptosModuleAbi,
} from "@txid/aptos"
import type { WatchedContractSnapshot } from "./types"

const isNonEvm = (chainId: string): boolean => isSolanaChain(chainId) || isAptosChain(chainId)

/**
 * Name the markets an Aptos transaction's arguments refer to, when a watched
 * protocol recognises them.
 *
 * The market reaches us as a bare object address, which tells a user nothing.
 * Resolving it is the difference between "your order was not found" and "your
 * ETH/USD order was not found", and the second is the answer they came for.
 *
 * Never allowed to fail the lookup it decorates: an unreachable node here
 * costs the name, not the diagnosis.
 */
async function withMarketNames<T extends { functionArguments?: unknown[] }>(
  tx: T,
  watchedContracts: readonly { address: string; chain: string }[],
): Promise<T> {
  const adapter = adapterFor(watchedContracts)
  if (!adapter) return tx
  const markets = await marketsInArguments(adapter, tx.functionArguments ?? []).catch(() => [])
  if (markets.length === 0) return tx
  // Making the name AVAILABLE is not enough: without being told, the model
  // keeps saying "your order", which is the vaguer answer this work existed to
  // remove. The note is what turns a resolved market into a named one.
  return {
    ...tx,
    markets,
    marketsNote: `This transaction refers to ${markets.map(m => m.name).join(", ")}. Name the market when you describe what the user was doing, for example "your ${markets[0]?.name} order" rather than "your order". These names are resolved from the transaction's own arguments, so they are facts about this transaction, not a guess.`,
  }
}

// The Aptos clients return null when the fetch itself failed — that is NOT an
// empty wallet / empty history, and the model must never present it as one.
const APTOS_LOOKUP_FAILED =
  "Could not reach the Aptos indexer to check this right now, this is a failed lookup, NOT a statement about the wallet's contents or history. Try again shortly."

// A missing transaction means something DIFFERENT on Aptos than on EVM, and the
// EVM instinct ("it is probably still pending, wait") is wrong here. Every Move
// transaction carries expiration_timestamp_secs; once that passes without
// commitment the transaction is permanently invalid and leaves NO on-chain
// record at all. Wallets still show the user a hash for it, so a user holding a
// hash that resolves to nothing is a normal, explainable Aptos outcome.
const APTOS_NOT_FOUND_CAUSES = [
  "The transaction expired before a validator committed it (every Aptos transaction has an expiration timestamp). It then leaves no record at all, even though the wallet showed a hash. Nothing was spent, and it is safe to retry.",
  "The sender's sequence number had already been used by another transaction, so this one could never be committed. Aptos sequence numbers are strictly ordered per account, like an EVM nonce.",
  "The transaction was submitted to a different network (testnet vs mainnet) than the one being searched.",
  "It was committed very recently and the indexer has not caught up yet. Retrying in a few seconds distinguishes this from the cases above.",
  // Discovered live 2026-08-19: the runbook's July demo hash 404'd from the
  // fullnode while the explorer still showed it. oldest_ledger_version proved
  // pruning; without this cause the model told the user their real, weeks-old
  // transaction did not exist.
  "The transaction is real but older than the node's retention window. Public Aptos fullnodes prune history after a few weeks, so an old transaction returns not-found here while block explorers still show it from archival storage. If the user says an explorer link works for this hash, the transaction exists and is simply old: ask them what the explorer shows (status and any error message) and reason from that, never insist the transaction does not exist.",
]

export interface WalletConfig {
  address: string
  chainId: string
}

/**
 * Resolve which watched contract a tool call refers to — chain-aware.
 * The same address is often deployed on several chains (CREATE2 / planned
 * nonces), so an address alone can be ambiguous: never silently pick the
 * first match. chainId (when provided) disambiguates; otherwise the caller
 * gets the ambiguousChains list back to re-ask with a chain.
 */
function findWatched(
  watchedContracts: WatchedContractSnapshot[],
  contractAddress: string | undefined,
  chainId: string | undefined,
): { target?: WatchedContractSnapshot; ambiguousChains?: string[] } {
  if (!contractAddress) {
    return watchedContracts.length === 1 ? { target: watchedContracts[0]! } : {}
  }
  // Aptos addresses have many equivalent spellings ("0x1" vs zero-padded) —
  // normalize both sides when both are Aptos-shaped (EVM 0x40hex normalizes
  // identically on both sides, so this is a no-op for EVM).
  const sameAddress = (a: string, b: string): boolean =>
    a.toLowerCase() === b.toLowerCase() ||
    (isAptosAddress(a) && isAptosAddress(b) && normalizeAptosAddress(a) === normalizeAptosAddress(b))
  const matches = watchedContracts.filter(c => sameAddress(c.address, contractAddress))
  if (matches.length === 0) {
    // The Aptos framework (0x1 core, 0x3 token v1, 0x4 token v2) is public,
    // read-only and the same for every project, so scoping reads to the
    // protocol's own modules blocks legitimate platform questions: staking
    // lockups, APT supply, object ownership, coin/FA pairing all live at 0x1.
    // Allow it as a synthetic target when the project is an Aptos one. This is
    // not a scope hole: these are chain-standard view functions, not another
    // protocol's contracts.
    const fw = isAptosAddress(contractAddress) ? normalizeAptosAddress(contractAddress) : null
    const isFramework = fw !== null && APTOS_FRAMEWORK_ADDRESSES.has(fw)
    if (isFramework && watchedContracts.some(c => isAptosChain(c.chain))) {
      return {
        target: {
          id: "aptos-framework",
          name: "Aptos framework",
          address: contractAddress,
          chain: "aptos",
          description: "The Aptos framework: core chain modules published at 0x1, 0x3 and 0x4.",
        } as WatchedContractSnapshot,
      }
    }
    return {}
  }
  if (matches.length === 1) return { target: matches[0]! }
  if (chainId) {
    const m = matches.find(c => c.chain.toLowerCase() === chainId.toLowerCase())
    if (m) return { target: m }
  }
  return { ambiguousChains: matches.map(c => c.chain) }
}

/**
 * Aptos view functions are addressed as addr::module::fn. The caller supplies
 * "module::fn" (or the full id) and the watched account fills in the address.
 * A fully-qualified name must point at the WATCHED account — otherwise this
 * tool would read state on arbitrary modules through a scoped tool.
 * When the watched contract pins a moduleName, a bare function name is
 * qualified against that module (the model doesn't have to know it).
 * Returns null when the name can't be qualified — the tool explains the format.
 */
function aptosFunctionId(contractAddress: string, functionName: string, defaultModule?: string): string | null {
  const parts = functionName.split("::").filter(Boolean)
  if (parts.length === 3) {
    const addr = parts[0]!
    if (!isAptosAddress(addr) || normalizeAptosAddress(addr) !== normalizeAptosAddress(contractAddress)) return null
    return functionName
  }
  if (parts.length === 2) return `${normalizeAptosAddress(contractAddress)}::${functionName}`
  if (parts.length === 1 && defaultModule) return `${normalizeAptosAddress(contractAddress)}::${defaultModule}::${functionName}`
  return null
}

/**
 * An Aptos account can host many modules. When the watched contract pins a
 * moduleName, fetch just that module's ABI; otherwise fall back to the
 * account's full module list.
 */
async function aptosModulesFor(target: WatchedContractSnapshot): Promise<AptosModuleAbi[] | null> {
  if (target.moduleName) {
    const m = await getAptosModuleAbi(target.address, target.moduleName)
    return m ? [m] : null
  }
  return getAptosModuleAbi(target.address)
}

const APTOS_FN_FORMAT_NOTE =
  "On Aptos, functions live inside named modules, call again with function_name as 'module::function' (e.g. 'pool::get_fee'). Only functions on this protocol's own module account can be read, and type arguments are not supported here. Use get_contract_functions to list this account's modules and their view functions."

const APTOS_FRAMEWORK_ADDRESSES = new Set(
  ["0x1", "0x3", "0x4"].map(normalizeAptosAddress),
)

const aptosFullnodeFailed = (what: string) =>
  `Could not reach the Aptos fullnode to ${what} right now, a failed lookup, not a statement about the account. Try again shortly.`

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

  // Staking is Aptos's largest retail support surface ("when can I unstake?"),
  // but the tool only exists for Aptos projects so EVM projects pay nothing
  // for its schema.
  const aptosProject = watchedContracts.some(c => isAptosChain(c.chain))
  const stakingTool: Anthropic.Tool[] = aptosProject
    ? [{
        name: "get_staking_positions",
        description:
          "Aptos only: the connected wallet's delegated staking. Returns each pool it delegates to with the exact active / inactive / pending_inactive amounts read from the chain, the pool's current lockup expiry, and recent staking events (AddStake, UnlockStake, WithdrawStake, ReactivateStake). " +
          "Use for 'am I staking', 'when can I unstake', 'where are my rewards', 'why has my stake not moved'.",
        input_schema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      }]
    : []

  const aptosExtraTools: Anthropic.Tool[] = aptosProject
    ? [
        {
          name: "get_nft_holdings",
          description:
            "Aptos only: the connected wallet's Digital Assets (NFTs), plus any PENDING token claims, i.e. tokens sent to them that have not been accepted yet. " +
            "Use for 'where is my NFT', 'someone sent me an NFT and it never arrived', 'what NFTs do I hold'.",
          input_schema: { type: "object" as const, properties: {}, required: [] },
        },
        {
          name: "get_object_info",
          description:
            "Aptos only: what an address actually IS. Reports whether it is an object rather than a wallet, who owns it, whether it can be transferred, and which resources it holds. " +
            "Use when an address behaves unexpectedly, when the user asks who owns something, or to explain that an address is a protocol-owned object and not their wallet.",
          input_schema: {
            type: "object" as const,
            properties: { address: { type: "string", description: "The Aptos address to inspect." } },
            required: ["address"],
          },
        },
      ]
    : []

  return [
    ...stakingTool,
    ...aptosExtraTools,
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
        "Use this proactively whenever the user mentions anything going wrong or asks if something worked, " +
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
      "The correct chain is detected automatically, do NOT ask the user which network it is on. " +
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
  const aptos = wallet ? isAptosChain(wallet.chainId) : false

  switch (name) {
    case "get_staking_positions": {
      if (!wallet) throw new Error("Wallet not connected")
      if (!aptos) return { note: "Delegated staking lookups here are Aptos only." }
      const [positions, activity] = await Promise.all([
        getAptosDelegations(wallet.address),
        getAptosStakingActivity(wallet.address, 10),
      ])
      if (positions === null && activity === null) {
        return { error: aptosFullnodeFailed("read this wallet's staking positions") }
      }
      // Lockups are per pool, so resolve them only for pools this wallet
      // actually uses rather than scanning every validator.
      const lockups = positions
        ? await Promise.all(
            positions.slice(0, 8).map(async p => [p.poolAddress, await getAptosPoolLockup(p.poolAddress)] as const),
          )
        : []
      return {
        walletAddress: wallet.address,
        ...(positions
          ? { positions, lockups: Object.fromEntries(lockups) }
          : { positionsNote: aptosFullnodeFailed("read this wallet's delegation positions") }),
        ...(activity ? { recentActivity: activity } : { activityNote: aptosFullnodeFailed("read this wallet's staking history") }),
        note: "Amounts are octas: 1 APT = 100,000,000 octas. 'active' is earning, 'pending_inactive' is unlocking this cycle, 'inactive' is withdrawable now. A lockup expiry is the CURRENT cycle's end: stake unlocked after that instant waits for the following cycle, so do not present it as a countdown for an unlock the user has not requested yet.",
      }
    }

    case "get_nft_holdings": {
      if (!wallet) throw new Error("Wallet not connected")
      if (!aptos) return { note: "Digital Asset lookups here are Aptos only." }
      const [held, pending] = await Promise.all([
        getAptosNfts(wallet.address, 25),
        getAptosPendingNftClaims(wallet.address, 25),
      ])
      if (held === null && pending === null) return { error: APTOS_LOOKUP_FAILED }
      return {
        walletAddress: wallet.address,
        ...(held ? { holdings: held } : { holdingsNote: APTOS_LOOKUP_FAILED }),
        ...(pending ? { pendingClaims: pending } : { pendingClaimsNote: APTOS_LOOKUP_FAILED }),
        note: "pendingClaims are tokens SENT to this wallet that have not been accepted. On the older token standard a transfer has to be claimed by the recipient unless they opted into direct transfers, so a token sitting here is the usual reason for 'someone sent me an NFT and it never arrived': it is not lost, the recipient just needs to claim it. An empty holdings list means this wallet holds no Digital Assets, NOT that the lookup failed.",
      }
    }

    case "get_object_info": {
      const addr = typeof input.address === "string" ? input.address.trim() : ""
      if (!addr) throw new Error("address is required")
      if (!isAptosAddress(addr)) return { address: addr, note: "This tool inspects Aptos addresses only." }
      const lookup = await getAptosObject(addr)
      if (!lookup) return { address: addr, error: APTOS_LOOKUP_FAILED }
      if (!lookup.found) {
        return {
          address: addr,
          isObject: false,
          note: "The indexer has no object at this address, so it is most likely an ordinary account (a wallet) rather than an object. This is a real answer, not a failed lookup.",
        }
      }
      return {
        ...lookup.object,
        isObject: true,
        note: "This address is an OBJECT, not a wallet: on Aptos protocols hold state in objects (a per-user trading subaccount, a market, an NFT). resourceTypes says what it actually is. allowUngatedTransfer false means it cannot be freely transferred, which is normal for protocol-owned objects and for soulbound tokens. Explain that sending funds to an object address is not the same as sending them to its owner.",
      }
    }

    case "get_wallet_balance": {
      if (!wallet) throw new Error("Wallet not connected")
      if (solana) {
        return getSolanaWalletBalance(wallet.address)
      }
      if (aptos) {
        // On Aptos a protocol's user state usually lives in ITS OWN account
        // object, not the wallet: Decibel keeps collateral and positions in a
        // per-user subaccount. Returning only the wallet balance would be a
        // confidently WRONG answer for any trader, so resolve the protocol
        // account alongside it whenever the watched protocol is a known one.
        const adapter = adapterFor(watchedContracts)
        const [balance, protocolAccount] = await Promise.all([
          getAptosWalletBalance(wallet.address),
          adapter ? getProtocolAccount(adapter, wallet.address) : Promise.resolve(null),
        ])
        if (!balance && !protocolAccount) return { error: APTOS_LOOKUP_FAILED }
        return {
          ...(balance ?? { walletBalanceNote: APTOS_LOOKUP_FAILED }),
          ...(protocolAccount
            ? { protocolAccount }
            : adapter
              ? { protocolAccountNote: `Could not resolve this wallet's ${adapter.name} ${adapter.accountLabel} right now, so do NOT present the wallet balance as their ${adapter.name} balance.` }
              : {}),
        }
      }
      const [native, tokenResult] = await Promise.all([
        getNativeBalance(wallet.address, wallet.chainId),
        tokensOrNote(wallet.address, wallet.chainId),
      ])
      if ("tokensUnavailable" in tokenResult) {
        return { address: wallet.address, native, ...tokenResult }
      }
      return { address: wallet.address, native, tokens: tokenResult.tokens.slice(0, 20) }
    }

    case "get_recent_transactions": {
      if (!wallet) throw new Error("Wallet not connected")
      const limit = Math.min(Number(input.limit ?? 10), 20)
      const programOrContract =
        typeof input.contract_address === "string" ? input.contract_address : undefined

      if (solana) {
        return getSolanaRecentTransactions(wallet.address, programOrContract, limit)
      }
      if (aptos) {
        const errmap = errmapFor(watchedContracts)
        // Delegated-trading protocols (Decibel) place orders via a session key
        // against the trader's subaccount OBJECT, so the wallet's own history
        // is empty for exactly the users with the most activity. Whenever the
        // watched protocol has a known adapter, resolve the protocol account
        // and merge both histories into one timeline.
        const adapter = adapterFor(watchedContracts)
        if (adapter) {
          const resolved = await resolveProtocolAccountAddress(adapter, wallet.address).catch(
            () => ({ status: "failed" as const }),
          )
          if (resolved.status === "ok") {
            const accountLabel = `${adapter.name} ${adapter.accountLabel}`
            const merged = await getAptosRecentTransactionsMerged(
              [
                { address: wallet.address, label: "wallet" },
                { address: resolved.address, label: accountLabel },
              ],
              programOrContract,
              limit,
              errmap,
            )
            if (!merged) return { error: APTOS_LOOKUP_FAILED }
            return {
              transactions: merged.transactions,
              note: `This history covers the user's wallet AND their ${accountLabel} (${resolved.address}), merged into one timeline; each transaction's activityOn field says which account it touched. ${adapter.name} orders are placed by a delegated session key on the trader's behalf, so those transactions show a sender that is NOT the user's wallet address: they are still this user's own activity, never someone else's. Transactions sent by the protocol's own engine (entry functions like admin_apis or public_apis) touched this ${adapter.accountLabel} because they processed something for it, a fill, funding, or a triggered order: look at each one's events involving this ${adapter.accountLabel} to say what actually happened to the user, and never present the keeper's entry-function name alone as the user's action.`,
              ...(merged.unavailable.length > 0
                ? {
                    unavailableAccounts: merged.unavailable,
                    unavailableNote:
                      "History for these accounts could not be fetched right now, so activity there is UNVERIFIED, not absent.",
                  }
                : {}),
            }
          }
          // "none" / "failed": fall through to plain wallet history.
        }
        const aptosTxs = await getAptosRecentTransactions(wallet.address, programOrContract, limit, errmap)
        return aptosTxs ?? { error: APTOS_LOOKUP_FAILED }
      }

      // EVM. THE CONTRACT FILTER USED TO MANUFACTURE FALSE NEGATIVES, twice
      // over, and the result was the assistant telling an active trader they
      // had never traded:
      //
      // 1. It fetched the wallet's last `limit` (10) transactions and THEN
      //    filtered to the contract. Anything the wallet did since, an
      //    approval, a transfer, another dApp, pushed the interaction out of
      //    the window, so the filter returned nothing and nothing meant never.
      //    The fetch window is now widened when a filter is in play.
      //
      // 2. `to === contract` is the wrong test for a DEX. A swap goes to the
      //    ROUTER, so filtering on a pool, factory or quoter address never
      //    matches, and neither does a trade routed through an aggregator or a
      //    different router version.
      //
      // So an empty filter result is no longer returned as an empty history.
      // The unfiltered window is returned instead, with the distinction stated,
      // and the model is told absence here is not proof of absence. Same
      // principle the Aptos path already applies: never let a lookup that did
      // not find something be reported as the thing not existing.
      // WRONG NETWORK IS THE FIRST THING TO RULE OUT, and this path could not
      // see it. Chain-mismatch detection existed only inside diagnose_wallet,
      // which the prompt reserves for "nothing works" questions. So "where is
      // the trade I just made" read history on whatever chain the wallet
      // happened to be on, found nothing, and reported that as no activity.
      // Checked BEFORE the read: there is no point reporting a history from a
      // chain the protocol does not exist on.
      const histProtocolChains = Array.from(
        new Set(watchedContracts.map(c => c.chain).filter((c): c is string => !!c)),
      )
      if (histProtocolChains.length > 0 && !histProtocolChains.includes(wallet.chainId)) {
        return {
          transactions: [],
          walletChain: wallet.chainId,
          protocolChains: histProtocolChains,
          note: `WRONG NETWORK, do not report this as an empty history. The wallet is connected to chain ${wallet.chainId}, and this protocol's contracts are on ${histProtocolChains.join(", ")}. This history is from the wrong chain, so it says NOTHING about whether the user has traded. Tell them to switch networks in their wallet and ask again. Never tell them they have no transactions with the protocol on the basis of this result.`,
        }
      }

      const window = programOrContract ? Math.min(Math.max(limit * 5, 50), 100) : limit
      const txs = await getRecentTransactions(wallet.address, wallet.chainId, window)
      if (!programOrContract) return txs

      const target = programOrContract.toLowerCase()
      const matched = txs.filter(tx => tx.to?.toLowerCase() === target)
      if (matched.length > 0) {
        return {
          transactions: matched.slice(0, limit),
          filteredTo: programOrContract,
          scanned: txs.length,
          note: "Matched on the transaction's direct recipient. A swap routed through an aggregator or a different router version would NOT appear here even though it reached the protocol, so this list is a floor, not a complete record.",
        }
      }
      return {
        transactions: txs.slice(0, limit),
        filteredTo: null,
        scanned: txs.length,
        note: `None of this wallet's last ${txs.length} transactions was sent DIRECTLY to ${programOrContract}, so the unfiltered history is returned instead. Do NOT tell the user they have no activity with this protocol. A swap reaches a DEX through a router, so it is sent to the router rather than to a pool or factory address, and a trade made through an aggregator or a newer router version will never match this address. Indexing also lags the chain by a few minutes, so a very recent transaction may not be here yet. Say what you actually checked and offer to look up a specific transaction hash.`,
      }
    }

    case "get_wallet_approvals": {
      if (!wallet) throw new Error("Wallet not connected")
      if (solana) return { approvals: [], note: "Approval listing is EVM-only." }
      if (aptos) {
        return {
          address: wallet.address,
          count: 0,
          approvals: [],
          note: "Aptos has no standing token approvals, coins and fungible assets can only move when the owner signs. Nothing to revoke.",
        }
      }
      const lookup = await getWalletApprovals(wallet.address, wallet.chainId)
      // An unanswered question must not render as an all-clear. Someone asking
      // what they have approved usually suspects they have been drained, and
      // "no approvals" is the answer that stops them revoking.
      if (lookup.status === "unavailable") {
        return {
          address: wallet.address,
          available: false,
          lookupFailed: true,
          note: "Could not read this wallet's approvals: the lookup did not complete. This is NOT a finding that the wallet has no approvals. Say the check did not run, and suggest they check a revoke tool directly rather than treating this as an all-clear.",
        }
      }
      if (lookup.status === "unsupported") {
        return {
          address: wallet.address,
          available: false,
          note: "Approval listing is not available on this chain, so the wallet was not checked. Do not imply it was checked and found clean.",
        }
      }
      return { address: wallet.address, count: lookup.approvals.length, approvals: lookup.approvals }
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
      // NOTE: all-numeric input is also valid base58 — if Solana is ever
      // un-paused alongside Aptos, the Aptos version short-circuit below must
      // move above this return.
      if (!looksEvm && solanaInPlay) {
        return getSolanaTransactionBySignature(hash)
      }

      // Aptos tx hashes are 0x+64hex — format-IDENTICAL to EVM hashes, so
      // format alone can't route them. When the session involves Aptos, query
      // the Aptos fullnode in parallel with the EVM candidates and use
      // whichever chain actually has the tx. An all-numeric input is an Aptos
      // transaction VERSION and can only be Aptos.
      const aptosInPlay =
        isAptosChain(providedChain ?? "") ||
        isAptosChain(wallet?.chainId ?? "") ||
        watchedContracts.some(c => isAptosChain(c.chain))
      const looksAptosVersion = /^\d+$/.test(hash)
      if (aptosInPlay && looksAptosVersion) {
        // errmapFor is pure/synchronous: protocol abort tables for the watched
        // Aptos contracts (decodeAbort adds the framework table by itself).
        const versionTx = await getAptosTransactionByHash(hash, errmapFor(watchedContracts))
        return versionTx
          ? { chainId: "aptos", ...(await withMarketNames(versionTx, watchedContracts)) }
          : {
              hash,
              chainId: "aptos",
              status: "not_found",
              note: "No Aptos user transaction exists at this version, or the fullnode could not be reached. Do not claim the transaction failed or was dropped; say it could not be found by this version number.",
              aptosNotFoundCauses: APTOS_NOT_FOUND_CAUSES,
            }
      }
      const checkAptos = aptosInPlay && looksEvm

      // Never assume the chain: search every relevant EVM chain for the hash and
      // use whichever one actually has it. Candidates in priority order:
      // the chain the user named, the connected wallet's chain, then the chains
      // this protocol's contracts live on.
      const candidates: string[] = []
      const pushEvm = (c?: string) => {
        if (c && !isNonEvm(c) && !candidates.includes(c)) candidates.push(c)
      }
      pushEvm(providedChain)
      pushEvm(wallet?.chainId ?? undefined)
      for (const c of watchedContracts) pushEvm(c.chain)
      if (candidates.length === 0 && !checkAptos) pushEvm("0x1")

      const knownAbis: Record<string, string> = {}
      for (const c of watchedContracts) {
        if (c.abi) knownAbis[c.address.toLowerCase()] = c.abi
      }

      // Look on all candidate chains at once (Aptos joins the same fan-out —
      // it tolerates misses like every other candidate); take the
      // highest-priority hit.
      const [results, aptosTx] = await Promise.all([
        Promise.all(
          candidates.map(async chainId => ({
            chainId,
            // Found, absent, or could not be asked. The third must never read as the second.
            tx: await getTransactionByHash(hash, chainId, knownAbis).catch((e: unknown) =>
              e instanceof LookupUnavailableError ? ("unreachable" as const) : null,
            ),
          })),
        ),
        checkAptos ? getAptosTransactionByHash(hash, errmapFor(watchedContracts)).catch(() => null) : Promise.resolve(null),
      ])
      const unreachableChains = results.filter(r => r.tx === "unreachable").map(r => r.chainId)
      const reachable = candidates.filter(c => !unreachableChains.includes(c))
      // "Checked" means a node answered. An unreachable chain was attempted, not checked.
      const checkedChains = checkAptos ? [...reachable, "aptos"] : reachable
      // Only when there WERE EVM candidates and none could be asked. An
      // Aptos-only session has no EVM candidates at all, and the fullnode
      // answering "no such transaction" is a real answer, not an outage; that
      // case must fall through to the not-found branch with its Aptos causes.
      if (candidates.length > 0 && reachable.length === 0 && !checkAptos) {
        return {
          hash,
          status: "lookup_failed",
          unreachableChains,
          lookupFailed: true,
          note: "None of the candidate chains could be reached, so this hash was NOT checked. Do not say it was not found, dropped, or never broadcast. Say the chain could not be read just now, that this says nothing about their transaction or their funds, and offer to try again.",
        }
      }
      const hit = results.find(r => r.tx && r.tx !== "unreachable") as { chainId: string; tx: Exclude<typeof results[number]["tx"], "unreachable" | null> } | undefined
      if (hit?.tx && aptosTx) {
        // Both an EVM chain and Aptos claim this hash (astronomically unlikely):
        // prefer the connected wallet's chain and say which chain was used.
        if (wallet && isAptosChain(wallet.chainId)) {
          return {
            chainId: "aptos",
            ...(await withMarketNames(aptosTx, watchedContracts)),
            chainNote: `A transaction with this hash also exists on EVM chain ${hit.chainId}; the Aptos one is shown because the connected wallet is on Aptos.`,
          }
        }
      }
      if (!hit?.tx && aptosTx) {
        // Aptos scope guard, mirroring the EVM one below: only diagnose txs
        // that touch this protocol's own Aptos modules (entry function or
        // emitted events), when any are watched.
        const aptosOwned = watchedContracts
          .filter(c => isAptosChain(c.chain))
          .map(c => normalizeAptosAddress(c.address))
        if (aptosOwned.length > 0) {
          const addrOf = (id: string) => {
            const sep = id.indexOf("::")
            return sep === -1 ? null : normalizeAptosAddress(id.slice(0, sep))
          }
          const touches =
            (aptosTx.functionId ? aptosOwned.includes(addrOf(aptosTx.functionId) ?? "") : false) ||
            aptosTx.events.some(e => aptosOwned.includes(addrOf(e.type) ?? "")) ||
            // A failure that ABORTED in one of the protocol's own modules is in
            // scope even if the tx entered through a third-party router (the
            // entry function/events would otherwise be a different address).
            (aptosTx.decodedAbort?.module ? aptosOwned.includes(addrOf(aptosTx.decodedAbort.module) ?? "") : false)
          if (!touches) {
            return {
              hash,
              chainId: "aptos",
              status: "out_of_scope",
              note: "This transaction does not involve any of this protocol's own modules, so it is outside what you can diagnose. Do NOT analyse it, decline in one sentence and offer to help with this protocol's own transactions.",
            }
          }
        }
        return { chainId: "aptos", ...(await withMarketNames(aptosTx, watchedContracts)) }
      }
      if (hit?.tx) {
        const tx = hit.tx
        // Enrich the mined tx with decoded args, EVERY event (decoded against all
        // known ABIs + standard events + 4byte fallback), token transfers, gas
        // verdict and confirmations (once, on the chain it was found on).
        const enrichment = await enrichTransaction(hash, hit.chainId, Object.values(knownAbis)).catch(() => null)

        // Scope guard: only diagnose transactions that TOUCH one of THIS
        // protocol's own contracts. We check three surfaces, not just `tx.to`:
        //   1. the top-level recipient (direct interaction)
        //   2. any event emitted BY a watched contract (catches interactions
        //      via a router/aggregator, where tx.to is the router but the
        //      protocol's own contract still emits its events)
        //   3. any token transfer whose token is a watched contract
        // A null `to` with no watched-contract involvement is out of scope
        // (e.g. a bare contract-creation tx).
        if (watchedContracts.length > 0) {
          const owned = new Set(watchedContracts.map(c => c.address.toLowerCase()))
          const touches =
            (tx.to ? owned.has(tx.to.toLowerCase()) : false) ||
            (enrichment?.events ?? []).some(e => e.contract && owned.has(e.contract.toLowerCase())) ||
            (enrichment?.tokenTransfers ?? []).some(t => owned.has(t.token.toLowerCase()))
          if (!touches) {
            return {
              hash,
              chainId: hit.chainId,
              status: "out_of_scope",
              to: tx.to ?? "contract creation",
              note: "This transaction does not involve any of this protocol's own contracts, so it is outside what you can diagnose. Do NOT analyse it, decline in one sentence and offer to help with this protocol's own transactions.",
            }
          }
        }
        const chainNote = aptosTx
          ? { chainNote: `A transaction with this hash also exists on Aptos; the ${hit.chainId} one is shown because the connected wallet/protocol context prefers it. Say which chain was used.` }
          : {}
        return enrichment ? { ...tx, ...enrichment, ...chainNote } : { ...tx, ...chainNote }
      }

      // Not mined on any candidate chain — diagnose pending/dropped on EVERY
      // candidate in parallel and prefer the chain where the tx is actually
      // visible (any cause other than "dropped"). Diagnosing only the first
      // candidate would misreport a tx that is pending on the protocol's
      // other chain as dropped.
      const pendingResults = await Promise.all(
        candidates.map(async chainId => ({
          chainId,
          diag: await diagnosePendingTx(hash, chainId, wallet?.address).catch(() => null),
        })),
      )
      // A node that answered outranks one that did not, whatever it said. An
      // unreachable chain must never be summarised as "dropped".
      const rank = (c: string) => (c === "lookup_failed" ? 2 : c === "dropped" ? 1 : 0)
      const best = [...pendingResults]
        .filter(r => r.diag)
        .sort((a, b) => rank(a.diag!.cause) - rank(b.diag!.cause))[0]
      if (best?.diag && best.diag.cause === "lookup_failed") {
        // Every candidate was unreachable. Say so; "checked" would be a lie.
        return {
          hash,
          status: "lookup_failed",
          unreachableChains: candidates,
          checkedChains,
          lookupFailed: true,
          pendingDiagnosis: best.diag,
          // Aptos may have answered even when every EVM chain was silent.
          note: checkedChains.length
            ? `The chains that could be reached (${checkedChains.join(", ")}) do not have this hash; the rest (${candidates.join(", ")}) could not be reached. Say exactly that: not found where it was checked, unchecked where it was not. Do not call it dropped. This says nothing about their funds; offer to try again.`
            : "None of the candidate chains could be reached, so this hash was NOT checked. Do not say it was not found, dropped, or never broadcast. Say the chain could not be read just now, that this says nothing about their transaction or their funds, and offer to try again.",
        }
      }
      if (best?.diag) {
        return {
          hash, chainId: best.chainId, status: "not_mined", pendingDiagnosis: best.diag, checkedChains,
          ...(unreachableChains.length ? { unreachableChains } : {}),
        }
      }
      return {
        hash,
        status: "not_found",
        checkedChains,
        ...(unreachableChains.length ? { unreachableChains } : {}),
        note: `This transaction was not found on any of the chains checked (${checkedChains.join(", ")}). Do not claim it is on, or dropped from, a specific chain, state which chains were checked.`,
        // Aptos was one of the chains searched, so the EVM default ("probably
        // still pending in the mempool") may be the wrong explanation entirely.
        ...(checkAptos ? { aptosNotFoundCauses: APTOS_NOT_FOUND_CAUSES } : {}),
      }
    }

    case "get_contract_transactions": {
      const contractAddress = input.contract_address
      if (typeof contractAddress !== "string" || !contractAddress) {
        throw new Error("contract_address is required")
      }
      // Scope guard (enforced, not just prompted): only THIS protocol's own
      // contracts can be read — otherwise the bot becomes a free analytics
      // tool for any address a user pastes.
      const target = watchedContracts.find(c => c.address.toLowerCase() === contractAddress.toLowerCase())
      if (!target) {
        return {
          contract: contractAddress,
          status: "out_of_scope",
          note: "This address is not one of this protocol's own contracts. Do NOT analyse it, decline in one sentence.",
        }
      }
      const chainId = typeof input.chain_id === "string" ? input.chain_id : target.chain
      const limit = Math.min(Number(input.limit ?? 10), 20)
      if (isSolanaChain(chainId)) {
        // For Solana, treat contract_address as a program address and fetch recent txs
        return getSolanaRecentTransactions(contractAddress, contractAddress, limit)
      }
      if (isAptosChain(chainId)) {
        // On Aptos the "contract" is a module-publishing account; fetch its
        // recent transactions filtered to calls into its own modules.
        const aptosTxs = await getAptosRecentTransactions(contractAddress, contractAddress, limit, errmapFor(watchedContracts))
        return aptosTxs ?? { contract: contractAddress, error: APTOS_LOOKUP_FAILED }
      }
      return getContractTransactions(contractAddress, chainId, limit)
    }

    case "get_contract_events": {
      const eventName = typeof input.event_name === "string" ? input.event_name : ""
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      if (!eventName) throw new Error("event_name is required")
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address) to read events from")
      if (isSolanaChain(target.chain)) {
        return { events: [], note: "Event history lookups are only available on EVM chains." }
      }
      if (isAptosChain(target.chain)) {
        // Two complementary Aptos sources, since the indexer's generic events
        // table was removed:
        //  1. asset-movement events, which ARE still indexed and go back in time
        //  2. the module's own recent transactions, for protocol-defined events
        const wantsAssetFlow = /deposit|withdraw|transfer|mint|burn|fund/i.test(eventName)
        const [activities, scan] = await Promise.all([
          wantsAssetFlow ? getAptosAssetActivities(target.address, 15) : Promise.resolve(null),
          getAptosModuleEvents(target.address, eventName),
        ])
        if (!scan && !activities) {
          return { contract: target.name, event: eventName, events: [], checked: false, error: "Could not reach the Aptos indexer to scan this module's transactions right now. This is a failed lookup, NOT evidence that the event never fired. Try again shortly." }
        }
        const recentEvents = (scan?.events ?? []).map(e => ({
          transactionHash: e.txHash,
          timestamp: e.timestamp,
          type: e.type,
          data: e.data,
          transactionSucceeded: e.success,
        }))
        return {
          contract: target.name,
          event: eventName,
          count: recentEvents.length,
          events: recentEvents,
          // The honest denominator: how far back we actually looked. Without
          // this an empty result reads as "never happened" when it only means
          // "not in the window we scanned".
          ...(scan
            ? {
                transactionsScanned: scan.transactionsScanned,
                searchWindowTruncated: scan.truncated,
                oldestScanned: scan.oldestTimestampScanned,
                newestScanned: scan.newestTimestampScanned,
              }
            : {}),
          ...(activities && activities.length > 0
            ? {
                assetActivity: activities.map(a => ({
                  type: a.type,
                  amount: a.amount,
                  asset: a.assetType,
                  timestamp: a.timestamp,
                  via: a.entryFunction,
                })),
                assetActivityNote: "These asset movement events come from the indexer and are a real history, not just a recent-transaction scan.",
              }
            : {}),
          checked: false,
          note: "On Aptos, asset movement events (deposits, withdrawals, mints, burns) are indexed and searchable, but protocol-defined events are NOT: the indexer's generic events table was retired. Protocol events are therefore recovered by scanning this module's recent transactions, and transactionsScanned says how many were actually inspected. If the list is empty, say the event does not appear in the last N transactions scanned (give the number and the oldest timestamp) and NEVER say it never fired. Offer explorer.aptoslabs.com for history older than the window.",
        }
      }
      const events = await getContractEvents(target.address, target.chain, eventName, target.abi ?? undefined)
      if (events.length === 0 && !canCheckEvent(eventName, target.abi ?? undefined)) {
        // Empty AND we couldn't compute this event's topic. Two very different
        // cases — do NOT let the model claim it never fired, and do NOT claim
        // the ABI is missing when it isn't:
        const hasAbi = !!target.abi
        return {
          contract: target.name,
          event: eventName,
          count: 0,
          events: [],
          checked: false,
          note: hasAbi
            ? `This contract's ABI is available, but it does not define a "${eventName}" event, so there is nothing to query. The most likely reason is that this contract simply does not emit that event, e.g. a swap router / periphery contract does NOT emit Swap or PoolCreated events; those are emitted by the individual pool/pair contracts (and factory), not the router. Tell the user this contract doesn't emit "${eventName}", suggest the specific pool/pair/factory address if they have it, and do NOT say the event never happened or that the ABI is missing.`
            : `Could not verify the "${eventName}" event, this contract's ABI isn't available yet, so the event signature can't be derived. Do NOT say it never happened; say you couldn't check this specific event and offer to have the team upload the contract's ABI.`,
        }
      }
      return { contract: target.name, event: eventName, count: events.length, events, checked: true }
    }

    case "get_contract_deployment": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address) to look up")
      if (isSolanaChain(target.chain)) {
        return { note: "Deployment lookup is only available on EVM chains." }
      }
      if (isAptosChain(target.chain)) {
        // Aptos has no contract-creation tx: modules are published to an
        // account, so the account's FIRST transaction is the true equivalent.
        const dep = await getAptosDeployment(target.address)
        if (!dep) return { contract: target.name, lookupFailed: true, note: "Could not look up when this account was created: the Aptos indexer or fullnode did not respond. This is a failed lookup, NOT a statement that the account is new or does not exist. Try again shortly." }
        const pkgs = await getAptosPackages(target.address)
        return {
          contract: target.name,
          publishedAt: dep.timestamp,
          publishedBy: dep.deployer,
          txHash: dep.txHash,
          version: dep.version,
          firstFunction: dep.functionId,
          ...(pkgs ? { packages: pkgs.map(p => ({ name: p.name, moduleCount: p.moduleNames.length })) } : {}),
          note: "On Aptos this is the module-publishing account's first on-chain transaction, which is when the account was created and its code first published. There is no separate contract-creation transaction as on EVM.",
        }
      }
      const deployment = await getContractDeployment(target.address, target.chain)
      return deployment
        ? { contract: target.name, ...deployment }
        : { contract: target.name, note: "Deployment details could not be retrieved." }
    }

    case "get_contract_holdings": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address) to check holdings for")
      if (isSolanaChain(target.chain)) {
        return getSolanaWalletBalance(target.address)
      }
      if (isAptosChain(target.chain)) {
        // A module-publishing account holds fungible assets like any account —
        // same lookup as a wallet balance (Solana precedent above).
        const holdings = await getAptosWalletBalance(target.address)
        return holdings
          ? {
              contract: target.name,
              ...holdings,
              note: "On Aptos, protocol funds often sit in separate resource accounts, not the module-publishing account: a low balance here does not mean the protocol holds no funds.",
            }
          : { contract: target.name, error: APTOS_LOOKUP_FAILED }
      }
      const [native, tokenResult] = await Promise.all([
        getNativeBalance(target.address, target.chain),
        tokensOrNote(target.address, target.chain),
      ])
      if ("tokensUnavailable" in tokenResult) {
        return { contract: target.name, address: target.address, native, ...tokenResult }
      }
      return { contract: target.name, address: target.address, native, tokens: tokenResult.tokens.slice(0, 30) }
    }

    case "get_contract_state": {
      const functionName = typeof input.function_name === "string" ? input.function_name : ""
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      if (!functionName) throw new Error("function_name is required")
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address) to read")
      if (isSolanaChain(target.chain)) {
        return { note: "Reading contract state is only available on EVM chains." }
      }
      if (isAptosChain(target.chain)) {
        const fnId = aptosFunctionId(target.address, functionName, target.moduleName)
        if (!fnId) return { contract: target.name, function: functionName, note: APTOS_FN_FORMAT_NOTE }
        const result = await viewFunction(fnId, [], [])
        return result
          ? { contract: target.name, function: fnId, result }
          : { contract: target.name, function: fnId, note: "The view call failed, the function may not exist, may require arguments or type arguments, or the Aptos fullnode did not respond." }
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
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address) to read")
      if (isSolanaChain(target.chain)) {
        return { note: "Reading contract data is only available on EVM chains." }
      }
      if (isAptosChain(target.chain)) {
        const fnId = aptosFunctionId(target.address, functionName, target.moduleName)
        if (!fnId) return { contract: target.name, function: functionName, note: APTOS_FN_FORMAT_NOTE }
        // Market-scoped views take an opaque object address, and the protocol's
        // market list is names-by-lookup only (Decibel: 60 markets, one view
        // call each). Resolving a human name like "BTC/USD" here turns a
        // question that would otherwise exhaust the tool-round budget into a
        // single call.
        const adapter = adapterFor(watchedContracts)
        let resolvedArgs = args
        let marketResolution: string | undefined
        if (adapter && args.some(a => !a.startsWith("0x"))) {
          const markets = await getProtocolMarkets(adapter)
          if (markets) {
            resolvedArgs = args.map(a => {
              if (a.startsWith("0x")) return a
              const needle = a.trim().toUpperCase().replace(/[-_]/g, "/")
              const hit =
                markets.find(m => m.name.toUpperCase() === needle) ??
                markets.find(m => m.name.toUpperCase().startsWith(needle.split("/")[0] + "/"))
              if (hit) {
                marketResolution = `Resolved market "${a}" to ${hit.name} (${hit.object}).`
                return hit.object
              }
              return a
            })
            if (resolvedArgs.some((a, i) => a === args[i] && !a.startsWith("0x"))) {
              marketResolution = `${marketResolution ?? ""} Known markets: ${markets.map(m => m.name).join(", ")}.`.trim()
            }
          }
        }
        const typeArgs = Array.isArray(input.type_args) ? input.type_args.map(t => String(t)) : []
        const result = await viewFunction(fnId, typeArgs, resolvedArgs)
        if (result && marketResolution) {
          return { contract: target.name, function: fnId, result, note: marketResolution }
        }
        return result
          ? { contract: target.name, function: fnId, args, result }
          : { contract: target.name, function: fnId, args, note: "The view call failed, check the argument count/types (addresses as 0x…, numbers as strings); functions needing type arguments are not supported here, or the Aptos fullnode did not respond." }
      }
      const data = await getContractData(target.address, target.chain, functionName, args, target.abi ?? undefined)
      return data
        ? { contract: target.name, ...data }
        : { contract: target.name, function: functionName, lookupFailed: true, note: "Could not read that function, it may take unsupported argument types, not be a view function, or have reverted." }
    }

    case "get_contract_info": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address) to look up")
      if (isSolanaChain(target.chain)) {
        return { note: "Verification/proxy info is only available on EVM chains." }
      }
      if (isAptosChain(target.chain)) {
        const modules = await aptosModulesFor(target)
        if (!modules) return { contract: target.name, error: aptosFullnodeFailed("inspect this account's modules") }
        return {
          contract: target.name,
          address: target.address,
          moduleCount: modules.length,
          modules: modules.map(m => ({
            name: m.moduleName,
            functionCount: m.functions.length,
            entryFunctions: m.functions.filter(f => f.isEntry).length,
            viewFunctions: m.functions.filter(f => f.isView).length,
          })),
          note: "Aptos modules always publish their full ABI on-chain, so there is no Etherscan-style 'verified/unverified' distinction, and no proxy/implementation concept, module code can only change under the package's declared upgrade policy.",
        }
      }
      const info = await getContractInfo(target.address, target.chain)
      return info ? { contract: target.name, ...info } : { contract: target.name, note: "Verification info could not be retrieved." }
    }

    case "get_contract_functions": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address)")
      if (isAptosChain(target.chain)) {
        const modules = await aptosModulesFor(target)
        if (!modules) return { contract: target.name, error: aptosFullnodeFailed("read this account's modules") }
        // A big Aptos package is enormous when fully expanded: Decibel's 91
        // modules serialise to ~15k tokens, which swallows the tool-round
        // budget and buries the handful of functions that answer the question.
        // Narrow by module when asked, otherwise return an index of module
        // names plus signatures only for modules that expose view functions.
        const filter = typeof input.module_name === "string" ? input.module_name.trim().toLowerCase() : ""
        const signature = (f: { name: string; params: string[] }) => `${f.name}(${f.params.join(", ")})`
        const selected = filter ? modules.filter(m => m.moduleName.toLowerCase() === filter) : modules
        if (filter && selected.length === 0) {
          return {
            contract: target.name,
            note: `No module named "${filter}" at this address.`,
            availableModules: modules.map(m => m.moduleName),
          }
        }

        const detailed = selected.map(m => ({
          module: m.moduleName,
          viewFunctions: m.functions.filter(f => f.isView).map(signature),
          entryFunctions: m.functions.filter(f => f.isEntry).map(signature),
        }))
        // Under this many modules the full listing is affordable, so keep it.
        if (filter || detailed.length <= 12) {
          return { contract: target.name, moduleCount: modules.length, modules: detailed }
        }
        const withViews = detailed.filter(m => m.viewFunctions.length > 0)
        return {
          contract: target.name,
          moduleCount: modules.length,
          allModules: modules.map(m => m.moduleName),
          readableModules: withViews.slice(0, 12).map(m => ({ module: m.module, viewFunctions: m.viewFunctions.slice(0, 20) })),
          note: `This package has ${modules.length} modules, too many to list in full. Shown: every module name, plus the view functions of the first ${Math.min(12, withViews.length)} modules that expose any. To see one module in detail, call this tool again with module_name set to the module you want.`,
        }
      }
      const fns = contractFunctions(target.abi ?? undefined)
      return { contract: target.name, readFunctions: fns.read, writeFunctions: fns.write }
    }

    case "get_upgrade_history": {
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address)")
      if (isSolanaChain(target.chain)) {
        return { upgrades: [], note: "Upgrade history is only available on EVM chains." }
      }
      if (isAptosChain(target.chain)) {
        // Aptos has no proxy/implementation pattern: packages are upgraded in
        // place, and the on-chain PackageRegistry records how many times each
        // has been upgraded plus whether it is still allowed to change.
        const pkgs = await getAptosPackages(target.address)
        if (!pkgs) return { contract: target.name, note: aptosFullnodeFailed("read this account's package registry") }
        const policyName = (p: number) => (p === 2 ? "immutable" : p === 1 ? "compatible" : "arbitrary")
        return {
          contract: target.name,
          packages: pkgs.map(p => ({
            name: p.name,
            timesUpgraded: p.upgradeNumber,
            upgradePolicy: policyName(p.upgradePolicy),
            moduleCount: p.moduleNames.length,
          })),
          note: "Aptos packages are upgraded in place rather than behind a proxy. timesUpgraded is the on-chain upgrade counter since first publish. upgradePolicy 'immutable' means the code can never change again; 'compatible' means it can be upgraded but only in backward-compatible ways.",
        }
      }
      const upgrades = await getUpgradeHistory(target.address, target.chain)
      return { contract: target.name, count: upgrades.length, upgrades }
    }

    case "get_token_info": {
      const token = typeof input.token_address === "string" ? input.token_address : undefined
      if (!token) throw new Error("token_address is required")
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? watchedContracts[0]?.chain ?? "")
      // No wallet, no watched contracts, no chain_id: there is no chain to ask.
      // This used to default to Ethereum and answer about the wrong network.
      if (!chainId) return { lookupFailed: true, note: "No chain is known for this request: no wallet is connected and this project has no watched contracts. Ask the user which network, or pass chain_id." }
      if (isSolanaChain(chainId)) return { note: "Token reads here are EVM-only." }
      if (isAptosChain(chainId)) {
        const rows = await getAptosAssetMetadata(token)
        if (rows === null) return { token, error: "Could not reach the Aptos indexer to look up this asset right now, a failed lookup, not a statement about the asset. Try again shortly." }
        const meta = rows[0]
        return meta ?? { token, note: "The Aptos indexer has no fungible-asset metadata for this asset type. Check the exact asset type (e.g. 0x1::aptos_coin::AptosCoin, or a metadata object address) on explorer.aptoslabs.com." }
      }
      const info = await getTokenInfo(token, chainId)
      return info ?? { token, lookupFailed: true, note: "Could not read token details (not an ERC-20, or the read failed)." }
    }

    case "get_token_allowance": {
      const token = typeof input.token_address === "string" ? input.token_address : undefined
      const owner = typeof input.owner === "string" ? input.owner : wallet?.address
      const spender = typeof input.spender === "string" ? input.spender : undefined
      if (!token || !owner || !spender) throw new Error("token_address, owner and spender are required")
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? watchedContracts[0]?.chain ?? "")
      // No wallet, no watched contracts, no chain_id: there is no chain to ask.
      // This used to default to Ethereum and answer about the wrong network.
      if (!chainId) return { lookupFailed: true, note: "No chain is known for this request: no wallet is connected and this project has no watched contracts. Ask the user which network, or pass chain_id." }
      if (isSolanaChain(chainId)) return { note: "Allowance reads here are EVM-only." }
      if (isAptosChain(chainId)) {
        return { note: "Aptos has no token-allowance concept, coins and fungible assets move only when the owner signs, so no approval is ever needed and there is nothing to check." }
      }
      const allowance = await getTokenAllowance(token, owner, spender, chainId)
      return allowance ?? { token, owner, spender, lookupFailed: true, note: "Could not read the allowance." }
    }

    case "get_token_price": {
      const token = typeof input.token_address === "string" ? input.token_address : undefined
      if (!token) throw new Error("token_address is required")
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? watchedContracts[0]?.chain)
      const price = await getTokenPrice(token, chainId)
      return price ?? { token, note: "No price found, the token may have no liquid DEX pair on this chain." }
    }

    case "get_native_price": {
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? watchedContracts[0]?.chain ?? "")
      // No wallet, no watched contracts, no chain_id: there is no chain to ask.
      // This used to default to Ethereum and answer about the wrong network.
      if (!chainId) return { lookupFailed: true, note: "No chain is known for this request: no wallet is connected and this project has no watched contracts. Ask the user which network, or pass chain_id." }
      if (isSolanaChain(chainId)) return { chainId, note: "Native price is not available for Solana here." }
      // "aptos" is handled by getNativeTokenPrice (APT priced by coin type on DexScreener)
      const price = await getNativeTokenPrice(chainId)
      return price ?? { chainId, lookupFailed: true, note: "Could not fetch the native token price for this chain." }
    }

    case "get_network_status": {
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? watchedContracts[0]?.chain ?? "")
      // No wallet, no watched contracts, no chain_id: there is no chain to ask.
      // This used to default to Ethereum and answer about the wrong network.
      if (!chainId) return { lookupFailed: true, note: "No chain is known for this request: no wallet is connected and this project has no watched contracts. Ask the user which network, or pass chain_id." }
      if (isSolanaChain(chainId)) return { chainId, note: "Network status is not available for Solana here." }
      if (isAptosChain(chainId)) {
        const aptosStatus = await getAptosNetworkStatus()
        return {
          chainId,
          ...aptosStatus,
          ...(aptosStatus.up
            ? {}
            : { note: "The Aptos fullnode did not respond or is lagging, the network (or this fullnode) may be having issues." }),
        }
      }
      const status = await getNetworkStatus(chainId)
      return status ?? { chainId, responsive: false, note: "The network RPC did not respond, the chain may be having issues." }
    }

    case "diagnose_wallet": {
      if (!wallet) throw new Error("Wallet not connected, connect a wallet to diagnose its network/RPC state")
      if (solana) return { note: "Wallet RPC diagnosis is EVM-only." }
      const chainId = wallet.chainId
      // Which chains does the protocol actually have contracts on? Used to spot
      // the #1 pre-tx failure: the wallet is connected to the wrong network.
      const protocolChains = Array.from(
        new Set(watchedContracts.map(c => c.chain).filter((c): c is string => !!c)),
      )
      // Compared CANONICALLY. A wallet reports hex ("0x38") and an interface
      // uses decimal ("56"); as raw strings those never matched, so users on
      // the right network were told to switch to the one they were already on.
      const walletChain = canonicalChainId(chainId)
      const onProtocolChain =
        protocolChains.length === 0 ||
        protocolChains.some(c => canonicalChainId(c) === walletChain)
      if (aptos) {
        // Include the protocol account (e.g. Decibel subaccount) in the
        // recent-failure count: delegated trading keeps failures off the
        // wallet's own history, so without this a failing trader diagnoses
        // as "no recent failures".
        const diagAdapter = adapterFor(watchedContracts)
        const diagAccount = diagAdapter
          ? await resolveProtocolAccountAddress(diagAdapter, wallet.address).catch(() => ({ status: "failed" as const }))
          : null
        const [diag, authKey] = await Promise.all([
          diagnoseAptosWallet(
            wallet.address,
            diagAdapter && diagAccount?.status === "ok"
              ? [{ address: diagAccount.address, label: `${diagAdapter.name} ${diagAdapter.accountLabel}` }]
              : undefined,
          ),
          // Aptos accounts can rotate their auth key while KEEPING their
          // address. Afterwards a wallet often derives a fresh address from the
          // new key, so the user sees an empty account and thinks their funds
          // are gone. Surfacing the rotation and any sibling addresses answers
          // that without touching credentials: this is a public index, and no
          // lost key can ever be recovered.
          getAptosAuthKeyStatus(wallet.address),
        ])
        // Null fields mean the underlying lookup FAILED — unverified, never "zero"/"none".
        // 0x1::coin::balance returns "0" (not null) for never-created accounts, so a
        // non-null aptBalance proves the fullnode was reachable and exists=false is real.
        const cautions: string[] = []
        if (!diag.exists && diag.aptBalance !== null) {
          cautions.push("exists=false: no account resource on Aptos mainnet, this address has most likely never sent a transaction (a common cause of 'nothing works': wrong address or wrong network in the wallet).")
        }
        if (!diag.exists && diag.aptBalance === null) {
          cautions.push("exists=false but the fullnode may have been unreachable, so the existence check itself may have failed, account existence is UNVERIFIED. Do not tell the user the account does not exist.")
        }
        if (diag.aptBalance === null) cautions.push("aptBalance is null because the balance lookup failed, the balance is UNVERIFIED, do not describe it as zero or empty.")
        if (diag.recentFailureCount === null) cautions.push("recentFailureCount is null because the recent-transaction lookup failed, whether recent transactions failed is UNVERIFIED, do not state a count.")
        return {
          walletAddress: wallet.address,
          chainId,
          onProtocolChain,
          protocolChains,
          ...diag,
          ...(authKey && authKey.rotated
            ? {
                keyRotation: {
                  rotated: true,
                  authKey: authKey.authKey,
                  otherAddressesSameKey: authKey.siblingAddresses,
                  note: "This account has ROTATED its authentication key: the address is unchanged but a different key now controls it. If the user says their funds vanished after changing keys, their wallet is most likely deriving a NEW address rather than showing this one, so point them at the addresses listed here. This is a public on-chain index. Never ask for a seed phrase or private key, and never imply a lost key can be recovered: it cannot.",
                },
              }
            : {}),
          ...(cautions.length > 0 ? { notes: cautions } : {}),
        }
      }
      // If the wallet is on the wrong network AND the protocol lives on exactly
      // one known EVM chain, surface a one-tap switch target. The stream layer
      // turns this into a "Switch to X" button in the widget.
      let switchTo: { chainId: string; chainName: string } | undefined
      const target = protocolChains[0]
      if (!onProtocolChain && protocolChains.length === 1 && target && !isNonEvm(target)) {
        const cfg = CHAIN_CONFIGS[target]
        if (cfg) switchTo = { chainId: target, chainName: cfg.name }
      }
      const diag = await diagnoseWalletRpc(wallet.address, chainId)
      if (!diag) {
        return {
          walletAddress: wallet.address,
          chainId,
          onProtocolChain,
          protocolChains,
          ...(switchTo ? { switchTo } : {}),
          lookupFailed: true,
          note: "Could not reach a public RPC for this chain, it may be unsupported or non-EVM.",
        }
      }
      return {
        ...diag,
        walletAddress: wallet.address,
        onProtocolChain,
        protocolChains,
        ...(switchTo ? { switchTo } : {}),
      }
    }

    case "check_token_safety": {
      const token = typeof input.token_address === "string" ? input.token_address : undefined
      if (!token) throw new Error("token_address is required")
      const chainId = typeof input.chain_id === "string" ? input.chain_id : (wallet?.chainId ?? watchedContracts[0]?.chain ?? "")
      // No wallet, no watched contracts, no chain_id: there is no chain to ask.
      // This used to default to Ethereum and answer about the wrong network.
      if (!chainId) return { lookupFailed: true, note: "No chain is known for this request: no wallet is connected and this project has no watched contracts. Ask the user which network, or pass chain_id." }
      if (isSolanaChain(chainId)) return { token, note: "Token safety screening is EVM-only." }
      if (isAptosChain(chainId)) {
        // No third-party scanner covers Aptos, so report the facts Aptos
        // itself publishes rather than guessing or refusing outright.
        const signals = await getAptosTokenSafety(token)
        if (!signals) {
          return { token, lookupFailed: true, note: "Could not read this asset's on-chain metadata, or the indexer has no record of it. Do not claim the asset is safe or unsafe." }
        }
        return {
          token,
          symbol: signals.symbol,
          name: signals.name,
          decimals: signals.decimals,
          creator: signals.creator,
          supply: signals.supply,
          maxSupply: signals.maxSupply,
          supplyCapped: signals.supplyCapped,
          standard: signals.standard === "v1" ? "legacy coin" : signals.standard === "v2" ? "fungible asset" : signals.standard,
          lastActivity: signals.lastActivity,
          freezeObserved: signals.freezeObserved,
          scannerAvailable: false,
          note: "These are on-chain FACTS about the asset, not a safety verdict: no third-party honeypot/scam scanner covers Aptos, so present them as signals the user can weigh. supplyCapped=false means supply has no declared hard cap (it can be increased), not that it is a scam. freezeObserved=true means at least one holder of this asset has actually been frozen, which implies a freeze capability exists and is in use. Never state the asset IS safe or IS a scam.",
        }
      }
      const safety = await getTokenSafety(token, chainId)
      return safety ?? { token, lookupFailed: true, note: "Could not screen this token, the chain may be unsupported or the safety API unavailable." }
    }

    case "resolve_ens_name": {
      const name = typeof input.name === "string" ? input.name.trim() : ""
      if (!name || !name.includes(".")) throw new Error("name is required, e.g. 'vitalik.eth'")
      const useAptos = name.toLowerCase().endsWith(".apt") || aptos || watchedContracts.some(c => isAptosChain(c.chain))
      if (useAptos) {
        const resolution = await resolveAptosName(name)
        // Four distinct outcomes. Collapsing them into one "not registered"
        // message told users something false about expired names.
        if (!resolution) {
          return { name, chain: "aptos", note: APTOS_LOOKUP_FAILED }
        }
        if (resolution.status === "active") {
          return {
            name: resolution.name,
            address: resolution.address,
            chain: "aptos",
            ...(resolution.expiresAt ? { registrationExpires: resolution.expiresAt } : {}),
          }
        }
        if (resolution.status === "expired") {
          return {
            name: resolution.name,
            chain: "aptos",
            resolves: false,
            expired: true,
            ...(resolution.expiredAt ? { expiredAt: resolution.expiredAt } : {}),
            ...(resolution.address ? { lastKnownAddress: resolution.address } : {}),
            note: "This name WAS registered but its registration has lapsed, so it does not currently resolve to anyone. Do NOT say it was never registered. Any address shown is the last one it pointed at and must not be treated as a current destination: sending there is unsafe. The name can be re-registered on aptosnames.com.",
          }
        }
        return { name: resolution.name, chain: "aptos", resolves: false, note: "The Aptos Names registry has no record of this name, so it has not been registered." }
      }
      const resolution = await resolveEnsName(name)
      return resolution ?? { name, lookupFailed: true, note: "ENS lookup failed, the resolver RPC did not respond." }
    }

    case "estimate_action": {
      const functionName = typeof input.function_name === "string" ? input.function_name : ""
      const contractAddress = typeof input.contract_address === "string" ? input.contract_address : undefined
      const args = Array.isArray(input.args) ? input.args.map(a => String(a)) : []
      if (!functionName) throw new Error("function_name is required")
      if (!wallet) throw new Error("Wallet not connected, estimates simulate from the user's address")
      const chainHint = typeof input.chain_id === "string" ? input.chain_id : undefined
      const { target, ambiguousChains } = findWatched(watchedContracts, contractAddress, chainHint)
      if (ambiguousChains) {
        return {
          contract: contractAddress,
          note: `This address is watched on multiple chains (${ambiguousChains.join(", ")}). Call this tool again with chain_id set to the chain the user means, infer it from context (their wallet's chain, the chain they named) or ask which chain if genuinely unclear.`,
        }
      }
      if (!target) throw new Error("Specify which contract (contract_address)")
      if (isSolanaChain(target.chain)) {
        return { note: "Action estimates are only available on EVM chains." }
      }
      if (isAptosChain(target.chain)) {
        const fnId = aptosFunctionId(target.address, functionName, target.moduleName)
        if (!fnId) return { contract: target.name, function: functionName, note: APTOS_FN_FORMAT_NOTE }
        const typeArgs = Array.isArray(input.type_args) ? input.type_args.map(t => String(t)) : []
        const sim = await simulateAptosEntryFunction(wallet.address, fnId, typeArgs, args, errmapFor(watchedContracts))
        if (!sim) {
          return {
            contract: target.name,
            function: fnId,
            note: "Could not simulate this call. Aptos simulation checks the sender's public key against their account, and that key is only recoverable from a transaction they have already sent, so a brand new wallet cannot be simulated. This is a limit of the check, NOT a prediction that the transaction would fail.",
          }
        }
        return {
          contract: target.name,
          function: fnId,
          wouldSucceed: sim.success,
          vmStatus: sim.vmStatus,
          gasUsed: sim.gasUsed,
          estimatedFeeApt: sim.estimatedFeeApt,
          ...(sim.decodedAbort ? { decodedAbort: sim.decodedAbort } : {}),
          note: sim.success
            ? "Simulated against current chain state: this call would succeed right now. The estimate is real VM execution, not a guess, but state can change before the user actually signs."
            : "Simulated against current chain state: this call would FAIL right now, for the reason in vmStatus/decodedAbort. Use that to tell the user what to fix before they try again.",
        }
      }
      const estimate = await estimateAction(target.address, target.chain, functionName, args, wallet.address, target.abi ?? undefined)
      return estimate
        ? { contractName: target.name, ...estimate }
        : { contractName: target.name, function: functionName, lookupFailed: true, note: "Could not estimate, the function may take unsupported argument types or not exist on this contract." }
    }

    case "check_address_sanctions": {
      const address = typeof input.address === "string" ? input.address
        : (typeof input.address === "undefined" ? wallet?.address : undefined)
      if (!address) throw new Error("address is required")
      // Aptos addresses share the 0x-hex shape with EVM but the oracle is
      // EVM-only. Guard on: not-EVM-length hex (Aptos allows 1–64 hex chars),
      // or an Aptos-connected wallet being screened.
      const isEvmFormat = /^0x[0-9a-fA-F]{40}$/.test(address)
      const screeningConnectedAptosWallet = aptos && typeof input.address === "undefined"
      if ((!isEvmFormat && isAptosAddress(address)) || screeningConnectedAptosWallet) {
        return {
          address,
          available: false,
          note: "Sanctions screening is not available for Aptos addresses, and there is nothing to screen against: the screening oracle is EVM-only, and OFAC's SDN list currently designates no Aptos addresses at all (its published digital-currency entries cover Bitcoin, Ethereum, Tron, USDT, Solana and similar, but not APT). Say this plainly rather than implying the address was checked and cleared: it was not checked.",
        }
      }
      const result = await checkSanctioned(address)
      return result ?? { address, lookupFailed: true, note: "Could not screen this address against the sanctions oracle." }
    }

    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}

/**
 * A token-balance read that reports its own failure.
 *
 * `.catch(() => [])` handed the model an empty token list whenever the indexer
 * wavered, and the model said "you hold no tokens". Same bug as the approvals
 * all-clear: a read that did not happen must not arrive looking like a finding,
 * and "your wallet is empty" is a finding people act on.
 *
 * The native balance is deliberately NOT guarded this way. It has no fallback,
 * so letting it throw is already honest.
 */
async function tokensOrNote(
  address: string,
  chainId: string,
): Promise<{ tokens: TokenBalance[] } | { tokensUnavailable: true; lookupFailed: true; note: string }> {
  try {
    return { tokens: await getTokenBalances(address, chainId) }
  } catch {
    return {
      tokensUnavailable: true,
      lookupFailed: true,
      note: "The token balance lookup failed, so the token list is UNKNOWN, not empty. Do not say the wallet holds no tokens. The native balance below was read successfully and can be quoted.",
    }
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
      "Use this PROACTIVELY when a user reports a transaction problem but hasn't connected their wallet, " +
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
  if (watchedContracts.length === 0) return null
  const lines = watchedContracts
    .map(c => {
      const events = eventNamesFromAbi(c.abi).slice(0, 40)
      return `${c.name} at ${c.address} (chain ${c.chain})${events.length ? `: known events: ${events.join(", ")}` : ""}`
    })
    .join("; ")
  return {
    name: "get_contract_events",
    description:
      "Read the on-chain history of a specific EVENT emitted by one of the protocol's contracts, newest first. " +
      "Use this to answer WHEN something happened or HOW OFTEN, e.g. 'when were fees last changed' (FeesChanged), " +
      "'has this ever been paused' (Paused), 'when was the last deposit', 'how many times has X happened'. " +
      "You can request ANY event by name, it works even if the event isn't in the listed ABI (it resolves events from the live log). " +
      "Always TRY it before saying you lack event history. Returns each occurrence's block timestamp and transaction hash; an empty result means that event genuinely has not fired. " +
      `Contracts${lines ? ` and their known events: ${lines}` : ""}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: {
          type: "string",
          description: "The contract address to read events from (use one from the list above).",
        },
        chain_id: {
          type: "string",
          description: "Chain ID, required when the same address is watched on multiple chains.",
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
        chain_id: {
          type: "string",
          description: "Chain ID, required when the same address is watched on multiple chains.",
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
      "Look up the tokens held BY one of the protocol's contracts, i.e. how many tokens are locked or custodied in it. " +
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
        chain_id: {
          type: "string",
          description: "Chain ID, required when the same address is watched on multiple chains.",
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
  // Aptos module ABIs live on-chain, so Aptos contracts qualify without a stored ABI.
  const withAbi = watchedContracts.filter(c => c.abi || isAptosChain(c.chain))
  if (withAbi.length === 0) return null
  const lines = withAbi
    .map(c => {
      if (isAptosChain(c.chain)) {
        return `${c.name} at ${c.address} (chain aptos), Move modules: pass function_name as 'module::function'; list views with get_contract_functions first`
      }
      const getters = viewGetterNames(c.abi).slice(0, 40)
      return `${c.name} at ${c.address} (chain ${c.chain}), getters: ${getters.join(", ") || "none"}`
    })
    .join("; ")
  return {
    name: "get_contract_state",
    description:
      "Read the CURRENT value of a no-argument view getter on one of the protocol's contracts, e.g. the current fee, whether it's paused right now, the owner, a total, a limit. " +
      "Use for 'what is the current fee', 'is the contract paused', 'who owns it', 'what is the <setting>'. Pass the contract address and the exact getter name. " +
      `Available contracts and their getters: ${lines}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: {
          type: "string",
          description: "The contract address to read (use one from the list above).",
        },
        chain_id: {
          type: "string",
          description: "Chain ID, required when the same address is watched on multiple chains.",
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
    .filter(x => x.fns.length > 0 || isAptosChain(x.c.chain))
  if (withArgFns.length === 0) return null
  const lines = withArgFns
    .map(({ c, fns }) =>
      isAptosChain(c.chain)
        ? `${c.name} at ${c.address} (chain aptos), Move modules: pass function_name as 'module::function'; list views with get_contract_functions first`
        : `${c.name} at ${c.address} (chain ${c.chain}), functions: ${fns.slice(0, 30).join("; ")}`,
    )
    .join(" | ")
  return {
    name: "get_contract_data",
    description:
      "Call a view function that takes ARGUMENTS on one of the protocol's contracts and get the decoded result, e.g. a user's lock (getUserLock(address)), an allowance, a balanceOf, a lock by index. " +
      "Use for questions about a specific address or index, especially the connected wallet's own position. Pass contract_address, function_name, and args in the exact order the function expects (addresses as 0x…, numbers as strings). " +
      `Available contracts and their argument-taking functions: ${lines}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: { type: "string", description: "The contract address (from the list above)." }, chain_id: { type: "string", description: "Chain ID, required when the same address is watched on multiple chains." },
        function_name: { type: "string", description: "The exact function name, e.g. 'getUserLock'." },
        args: {
          type: "array",
          items: { type: "string" },
          description: "Arguments in order. Addresses as 0x…, numbers as decimal strings, booleans as 'true'/'false'.",
        },
        type_args: {
          type: "array",
          items: { type: "string" },
          description: "Aptos only: generic type arguments, e.g. ['0x1::aptos_coin::AptosCoin'] for a generic view like 0x1::coin::supply<CoinType>. Omit when the function is not generic.",
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
      properties: { contract_address: { type: "string", description: "The contract address (from the list above)." }, chain_id: { type: "string", description: "Chain ID, required when the same address is watched on multiple chains." } },
      required: ["contract_address"],
    },
  }
}

export function buildContractFunctionsTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  // Aptos module ABIs live on-chain, so Aptos contracts qualify without a stored ABI.
  const withAbi = watchedContracts.filter(c => c.abi || isAptosChain(c.chain))
  if (withAbi.length === 0) return null
  const list = withAbi.map(c => `${c.name} at ${c.address}`).join(", ")
  return {
    name: "get_contract_functions",
    description:
      "List what a contract can do, its read (view) functions and write (state-changing) functions, from the ABI. " +
      "Use for 'what can this contract do', 'what functions does it have', 'how do I interact with it'. " +
      `Contracts: ${list}.`,
    input_schema: {
      type: "object" as const,
      properties: { contract_address: { type: "string", description: "The contract address (from the list above)." }, chain_id: { type: "string", description: "Chain ID, required when the same address is watched on multiple chains." }, module_name: { type: "string", description: "Aptos only: narrow to one module. Large packages return a module index instead of every signature, so call again with this set to drill in." } },
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
      properties: { contract_address: { type: "string", description: "The contract address (from the list above)." }, chain_id: { type: "string", description: "Chain ID, required when the same address is watched on multiple chains." } },
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
        "Check how much of a token the owner has approved a spender to move, answers 'do I need to approve first?'. " +
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
        "Returns the price, the DEX/chain, and the pair's liquidity. Pass the token address and, when known, the chain.",
      input_schema: {
        type: "object" as const,
        properties: {
          token_address: { type: "string", description: "The token contract address." },
          chain_id: { type: "string", description: "The chain the token is on (e.g. '0x1', '0x2105'), filters out same-address tokens on other chains." },
        },
        required: ["token_address"],
      },
    },
  ]
}

/** Token scam/honeypot screen (GoPlus, free + keyless) — always offered. */
export function buildTokenSafetyTool(): Anthropic.Tool {
  return {
    name: "check_token_safety",
    description:
      "Screen a token contract for scam characteristics: honeypot (can't sell), buy/sell tax, owner minting, " +
      "balance manipulation, pausable transfers, blacklists, unverified source. " +
      "Use for 'is this token a scam', 'why can't I sell this token', 'is it safe to buy', or when a diagnosis " +
      "suggests a token is behaving abnormally. Returns structured flags, report the red flags plainly.",
    input_schema: {
      type: "object" as const,
      properties: {
        token_address: { type: "string", description: "The token contract address to screen." },
        chain_id: { type: "string", description: "Optional chain ID; defaults to the connected wallet or the protocol's chain." },
      },
      required: ["token_address"],
    },
  }
}

/** ENS forward resolution — always offered. */
export function buildEnsTool(): Anthropic.Tool {
  return {
    name: "resolve_ens_name",
    description:
      "Resolve a human-readable name to its address. Handles ENS names like 'vitalik.eth' (to an Ethereum address) " +
      "and Aptos Names (ANS) like 'greg.apt' (to an Aptos address). " +
      "Use whenever the user provides a .eth, .apt, or other name service name instead of a raw address, " +
      "then use the resolved address with the other tools.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "The name to resolve, e.g. 'vitalik.eth' or 'greg.apt'." },
      },
      required: ["name"],
    },
  }
}

/**
 * Pre-flight estimate of a write action from the connected wallet —
 * offered when a wallet is connected and a watched contract has an ABI.
 * Doubles as a lightweight simulation: a revert here means the action
 * would fail right now, with the reason.
 */
export function buildEstimateActionTool(
  watchedContracts: WatchedContractSnapshot[] = [],
): Anthropic.Tool | null {
  const withAbi = watchedContracts.filter(c => c.abi)
  if (withAbi.length === 0) return null
  const lines = withAbi
    .map(c => {
      const writes = contractFunctions(c.abi).write.slice(0, 30)
      return `${c.name} at ${c.address} (chain ${c.chain}), write functions: ${writes.join("; ") || "none"}`
    })
    .join(" | ")
  return {
    name: "estimate_action",
    description:
      "Pre-flight a write action WITHOUT sending it: simulates the exact call from the connected wallet via eth_estimateGas. " +
      "Two uses: (1) 'how much will X cost?' → returns gas units, gas price and estimated cost in the native token; " +
      "(2) 'would it work if I retried now?' → if the node reports a revert, the action would FAIL right now and the revert reason says why. " +
      "Pass contract_address, function_name and args in order (addresses as 0x…, numbers as decimal strings in the token's base units). " +
      `Available contracts and write functions: ${lines}.`,
    input_schema: {
      type: "object" as const,
      properties: {
        contract_address: { type: "string", description: "The contract address (from the list above)." }, chain_id: { type: "string", description: "Chain ID, required when the same address is watched on multiple chains." },
        function_name: { type: "string", description: "The exact write function name, e.g. 'lockTokens'." },
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

/** OFAC sanctions screening for an address (Chainalysis on-chain oracle). */
export function buildSanctionsTool(): Anthropic.Tool {
  return {
    name: "check_address_sanctions",
    description:
      "Screen an address against the OFAC sanctions list (via the Chainalysis on-chain oracle). " +
      "Use for 'is this address sanctioned / safe / OFAC-listed', 'is my counterparty flagged', or before advising interaction with an unknown address. " +
      "Omit the address to screen the connected wallet. Returns whether the address is sanctioned and the source.",
    input_schema: {
      type: "object" as const,
      properties: {
        address: { type: "string", description: "The address to screen (0x…). Omit to screen the connected wallet." },
      },
      required: [],
    },
  }
}

/** Native gas-token price (AVAX / ETH / BNB / POL) — always offered. */
export function buildNativePriceTool(): Anthropic.Tool {
  return {
    name: "get_native_price",
    description:
      "Get the current USD price of a chain's NATIVE gas token, AVAX on Avalanche, ETH on Ethereum/Base/Arbitrum/Optimism, BNB on BNB Chain, POL on Polygon. " +
      "Use for 'what's the price of AVAX / ETH / BNB', 'how much is the native token'. Defaults to the connected wallet's chain or the protocol's chain if chain_id is omitted.",
    input_schema: {
      type: "object" as const,
      properties: {
        chain_id: { type: "string", description: "Optional chain ID; defaults to the connected wallet or the protocol's chain." },
      },
      required: [],
    },
  }
}

/** Live network status — current gas, base fee, recommended max fee, RPC health. */
export function buildNetworkTool(): Anthropic.Tool {
  return {
    name: "get_network_status",
    description:
      "Get a chain's live status: current gas price, base fee, a recommended max fee to set, the latest block, and whether the chain's RPC is responding. " +
      "Use for 'what's the current gas price', 'how much gas should I set', 'is the network busy/congested', and to confirm the CHAIN is healthy when a user's transaction can't be found (if the chain responds but the tx isn't visible, it's the user's own wallet RPC that's failing).",
    input_schema: {
      type: "object" as const,
      properties: {
        chain_id: { type: "string", description: "Optional chain ID; defaults to the connected wallet or the protocol's chain." },
      },
      required: [],
    },
  }
}

/** Wallet-level RPC/network diagnosis for the connected wallet. Wallet-gated. */
export function buildWalletDiagnosisTool(): Anthropic.Tool {
  return {
    name: "diagnose_wallet",
    description:
      "Diagnose the connected wallet's network/RPC state, the failures that happen BEFORE a transaction ever lands. " +
      "Call this FIRST when the user reports that things fail with no specific tx hash: 'nothing works', 'my transactions won't go through / keep failing', 'I can't send / swap / claim', 'MetaMask internal JSON-RPC error', 'stuck pending', or 'wrong network'. " +
      "Returns: which chain the wallet is on and whether that matches the protocol's contracts (onProtocolChain, false means the user is on the WRONG NETWORK, the single most common cause), the wallet's native balance and whether it's too empty to pay gas (outOfGasFunds), any stuck pending transactions blocking new sends (stuckPendingTxs), and whether the chain's RPC is responding (networkResponsive false → the network/RPC is down). " +
      "If networkResponsive is true but the user still can't transact, their own wallet RPC endpoint is likely failing, tell them to switch to a fresh public RPC via Chainlist.org.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
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
            "A concise 1–2 sentence description of the user's issue, written in plain English directly for the user to read, NOT internal diagnostic notes. " +
            "Write as if confirming their issue to them: empathetic, user-facing, no technical jargon, no mention of what you tried internally. " +
            "Example (good): 'Your token lock transactions on BNB Chain are failing, our team will investigate what's preventing them from going through.' " +
            "Example (bad): 'User's three lock transactions failed with gas/revert errors. Need to investigate wallet state and contract interactions.'",
        },
        reason: {
          type: "string",
          // "feedback" and "bug" are NOT escalations, they are recordings. They
          // were missing here while the prompt instructed the model to use
          // "feedback", so it sent a value the schema DID allow, the widget saw
          // a normal escalation and showed a support form to a tester who had
          // just paid a compliment. A schema that contradicts the prompt is
          // resolved silently and in the wrong direction.
          enum: ["unresolved", "user_requested", "account_issue", "billing", "urgent", "feedback", "bug"],
          description:
            "Why this is being recorded. Use \"feedback\" for an opinion or suggestion and \"bug\" for something broken: both are logged for the team and neither opens a support case or asks the user for contact details.",
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
  get_network_status: "Checking network status…",
  diagnose_wallet: "Diagnosing your wallet & network…",
  get_native_price: "Checking native token price…",
  check_address_sanctions: "Screening address (OFAC)…",
  check_token_safety: "Screening token safety…",
  resolve_ens_name: "Resolving name…",
  estimate_action: "Simulating the action…",
}
