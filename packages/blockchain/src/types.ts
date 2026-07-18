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
  errorName?: string       // e.g. "SlippageTooHigh" — used to match error glossary entries
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

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
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
