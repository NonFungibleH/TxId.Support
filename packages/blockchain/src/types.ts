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

export interface Transaction {
  hash: string
  blockNumber: string
  timestamp: string
  from: string
  to: string | null
  value: string          // in native currency, formatted
  gasUsed: string
  status: "success" | "failed"
  summary: string        // human-readable one-liner
}

export interface ChainConfig {
  id: string
  name: string
  nativeCurrency: string
  explorer: string
  moralisChain: string   // Moralis chain identifier
  rpcUrl: string
}

export const CHAIN_CONFIGS: Record<string, ChainConfig> = {
  "0x1": {
    id: "0x1",
    name: "Ethereum",
    nativeCurrency: "ETH",
    explorer: "https://etherscan.io",
    moralisChain: "eth",
    rpcUrl: "https://cloudflare-eth.com",
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
    rpcUrl: "https://polygon-rpc.com",
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
}
