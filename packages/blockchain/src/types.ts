export interface TokenBalance {
  tokenAddress: string
  symbol: string
  name: string
  decimals: number
  balance: string        // raw balance string
  balanceFormatted: string // human-readable (e.g. "1,234.56")
  usdValue: string | null
  logo: string | null
}

export interface NativeBalance {
  balance: string
  balanceFormatted: string
  symbol: string
}

export interface DecodedRevert {
  cause: "out_of_gas" | "revert_reason" | "custom_error" | "panic" | "unknown_revert"
  reason: string           // raw error string or description
  errorName?: string       // e.g. "SlippageTooHigh", used to match error glossary entries
  errorSignature?: string  // e.g. "SlippageTooHigh(uint256,uint256)"
  rawHex?: string
  gasInfo: { used: number; limit: number; percentUsed: number }
}

// Diagnosis for a hash that is NOT a mined transaction — pending, stuck,
// dropped, or unaffordable. Produced by diagnosePendingTx via raw JSON-RPC.
export interface PendingDiagnosis {
  cause:
    | "pending_stuck_nonce"      // an earlier pending tx is blocking this one
    | "pending_underpriced"      // gas fee below current network rate
    | "pending_congestion"       // in mempool, just waiting to be mined
    | "dropped"                  // unknown to the node: dropped/replaced/never broadcast
    | "insufficient_gas_balance" // wallet has no native token to pay gas
  reason: string                 // plain-English description
  detail?: string                // extra specifics (fees, nonce gap) when available
}

export interface Transaction {
  hash: string
  blockNumber: string
  timestamp: string
  from: string
  to: string | null
  value: string          // in native currency, formatted
  gasLimit: string       // gas limit set by the sender
  gasUsed: string        // actual gas consumed (gasUsed ≈ gasLimit → out-of-gas)
  status: "success" | "failed"
  summary: string        // human-readable one-liner
  method?: string        // decoded function name from the input selector (when ABI known)
  decodedRevert?: DecodedRevert  // present for failed transactions
}

export interface ChainConfig {
  id: string
  name: string
  nativeCurrency: string
  explorer: string
  /** Moralis chain identifier. Omitted for chains Moralis doesn't index (e.g.
   *  Etherlink) — those route the wallet tools through blockscoutApi + RPC. */
  moralisChain?: string
  rpcUrl: string
  /** Blockscout v2 REST API base (e.g. https://explorer.etherlink.com/api).
   *  Set for non-Moralis chains; the wallet adapter falls back to it. */
  blockscoutApi?: string
}

const DEFAULT_CHAIN_CONFIGS: Record<string, ChainConfig> = {
  "0x1": {
    id: "0x1",
    name: "Ethereum",
    nativeCurrency: "ETH",
    explorer: "https://etherscan.io",
    moralisChain: "eth",
    // cloudflare-eth.com was decommissioned (returns -32046 "Cannot fulfill
    // request"); PublicNode is a reliable keyless replacement.
    rpcUrl: "https://ethereum-rpc.publicnode.com",
  },
  "0x2105": {
    id: "0x2105",
    name: "Base",
    nativeCurrency: "ETH",
    explorer: "https://basescan.org",
    moralisChain: "base",
    rpcUrl: "https://mainnet.base.org",
  },
  "0x38": {
    id: "0x38",
    name: "BNB Chain",
    nativeCurrency: "BNB",
    explorer: "https://bscscan.com",
    moralisChain: "bsc",
    rpcUrl: "https://bsc-dataseed.binance.org",
  },
  "0x89": {
    id: "0x89",
    name: "Polygon",
    nativeCurrency: "MATIC",
    explorer: "https://polygonscan.com",
    moralisChain: "polygon",
    // polygon-rpc.com now returns "tenant disabled" (403); PublicNode is a
    // reliable keyless replacement.
    rpcUrl: "https://polygon-bor-rpc.publicnode.com",
  },
  "0xa4b1": {
    id: "0xa4b1",
    name: "Arbitrum",
    nativeCurrency: "ETH",
    explorer: "https://arbiscan.io",
    moralisChain: "arbitrum",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
  },
  "0xa": {
    id: "0xa",
    name: "Optimism",
    nativeCurrency: "ETH",
    explorer: "https://optimistic.etherscan.io",
    moralisChain: "optimism",
    rpcUrl: "https://mainnet.optimism.io",
  },
  "0xa86a": {
    id: "0xa86a",
    name: "Avalanche",
    nativeCurrency: "AVAX",
    explorer: "https://snowtrace.io",
    moralisChain: "avalanche",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
  },
  "0xa729": {
    id: "0xa729",
    name: "Etherlink",
    nativeCurrency: "XTZ",
    explorer: "https://explorer.etherlink.com",
    rpcUrl: "https://node.mainnet.etherlink.com",
    blockscoutApi: "https://explorer.etherlink.com/api",
    // No moralisChain — Moralis doesn't index Etherlink; wallet tools use
    // Blockscout (recent txs, balances) + RPC (single tx, revert decode).
  },
}

/**
 * Swap any chain's RPC endpoint from the environment, without a deploy.
 *
 * WHY. Every EVM chain above defaults to a FREE PUBLIC endpoint with no key,
 * no quota and no SLA: bsc-dataseed for BNB Chain, publicnode for Ethereum,
 * and so on. They are fine for development and they throttle under real
 * traffic, which surfaces as the assistant telling a user it cannot read the
 * chain. That happened in a live demo, and the URL being a hardcoded constant
 * meant the only fix was a commit and a deploy.
 *
 * The RPC is not a minor path. `diagnose_wallet` reads balance, nonce and
 * pending count through it, `get_network_status` reads gas through it, and the
 * failed-transaction decoder replays through it. When it throttles, the most
 * valuable answers are the ones that stop working.
 *
 * Set RPC_URLS to a JSON object keyed by chain id OR by chain name:
 *
 *   RPC_URLS={"bnb":"https://bnb.example.com/v2/KEY","ethereum":"https://eth.example.com/KEY"}
 *
 * Names are accepted because `0x38` tells a human nothing, and an env var
 * nobody can read is one nobody maintains. Matching ignores case and spaces,
 * so "BNB Chain", "bnbchain" and "bsc" all resolve. Hex ids keep working.
 *
 * Unlisted chains keep their default. A malformed value is ignored rather than
 * thrown, because a typo in an env var must not take every chain down.
 */
/** Extra spellings people actually type for a chain. */
const CHAIN_ALIASES: Record<string, string> = {
  bsc: "0x38",
  binance: "0x38",
  eth: "0x1",
  mainnet: "0x1",
  matic: "0x89",
  arb: "0xa4b1",
  op: "0xa",
  avax: "0xa86a",
}

const normalise = (s: string) => s.toLowerCase().replace(/[\s_-]/g, "")

/** A chain id, or a chain name, to a chain id. Null if it matches nothing. */
function resolveChainKey(key: string): string | null {
  if (DEFAULT_CHAIN_CONFIGS[key]) return key
  const k = normalise(key)
  const alias = CHAIN_ALIASES[k]
  if (alias && DEFAULT_CHAIN_CONFIGS[alias]) return alias
  for (const [id, cfg] of Object.entries(DEFAULT_CHAIN_CONFIGS)) {
    if (normalise(cfg.name) === k || normalise(id) === k) return id
  }
  return null
}

function rpcOverrides(): Record<string, string> {
  const raw = process.env.RPC_URLS
  if (!raw) return {}
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return {}
    const out: Record<string, string> = {}
    for (const [key, url] of Object.entries(parsed as Record<string, unknown>)) {
      // Only http(s). A wrong scheme here would fail on every call instead of
      // falling back, which is worse than ignoring it.
      if (typeof url !== "string" || !/^https?:\/\//i.test(url)) continue
      const chainId = resolveChainKey(key)
      if (chainId) out[chainId] = url
    }
    // A SET-BUT-USELESS VALUE IS THE DANGEROUS CASE. Ignoring bad input keeps a
    // typo from taking every chain down, but it also means someone can believe
    // they have moved off the public endpoints when they have not. Say so.
    if (Object.keys(out).length === 0) {
      console.warn("[chains] RPC_URLS parsed but contained no usable http(s) endpoints. Still using the free public ones.")
    }
    return out
  } catch {
    console.warn("[chains] RPC_URLS is set but is not valid JSON. Ignoring it and using the free public endpoints.")
    return {}
  }
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = (() => {
  const overrides = rpcOverrides()
  if (Object.keys(overrides).length === 0) return DEFAULT_CHAIN_CONFIGS
  const merged: Record<string, ChainConfig> = {}
  for (const [id, cfg] of Object.entries(DEFAULT_CHAIN_CONFIGS)) {
    merged[id] = overrides[id] ? { ...cfg, rpcUrl: overrides[id]! } : cfg
  }
  return merged
})()
