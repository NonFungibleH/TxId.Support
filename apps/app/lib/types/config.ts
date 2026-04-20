export const SUPPORTED_CHAINS = [
  { id: "0x1",      name: "Ethereum",          explorer: "etherscan.io" },
  { id: "0xaa36a7", name: "Sepolia (Testnet)",  explorer: "sepolia.etherscan.io" },
  { id: "0x2105",   name: "Base",              explorer: "basescan.org" },
  { id: "0x38",     name: "BNB Chain",         explorer: "bscscan.com" },
  { id: "0x89",     name: "Polygon",           explorer: "polygonscan.com" },
  { id: "0xa4b1",   name: "Arbitrum",          explorer: "arbiscan.io" },
  { id: "0xa",      name: "Optimism",          explorer: "optimistic.etherscan.io" },
] as const

export type ChainId = (typeof SUPPORTED_CHAINS)[number]["id"]

export const SUPPORTED_FONTS = [
  "Inter", "Sora", "Space Mono", "DM Sans", "IBM Plex Mono", "Outfit",
] as const

export type SupportedFont = (typeof SUPPORTED_FONTS)[number]

export interface BrandingConfig {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  font: SupportedFont
  logoUrl: string | null
  position: "bottom-right" | "bottom-left" | "inline"
  theme: "dark" | "light"
}

export interface TokenConfig {
  address: string
  chain: ChainId
  dexUrl: string | null
  symbol: string | null
  name: string | null
}

export interface WatchedContract {
  id: string
  name: string
  address: string
  chain: ChainId
  description: string
}

export type ContentBlockType = "video" | "text" | "tokenomics" | "link" | "image" | "html"

export interface ContentBlock {
  id: string
  type: ContentBlockType
  title: string
  content: unknown
  order: number
}

export interface CommunityConfig {
  discord:      string | null
  twitter:      string | null
  telegram:     string | null
  website:      string | null
  whitepaper:   string | null
  announcement: string | null
}

export interface ProjectConfig {
  branding: BrandingConfig
  token: TokenConfig | null
  chains: ChainId[]
  contentBlocks: ContentBlock[]
  docsUrl: string | null
  allowedDomains: string[]
  watchedContracts: WatchedContract[]
  community: CommunityConfig | null
  tokenModeAsk: string | null
}

export const DEFAULT_CONFIG: ProjectConfig = {
  branding: {
    primaryColor: "#6366f1",
    secondaryColor: "#4f46e5",
    backgroundColor: "#0f0f0f",
    textColor: "#ffffff",
    font: "Inter",
    logoUrl: null,
    position: "bottom-right",
    theme: "dark",
  },
  token: null,
  chains: ["0x1"],
  contentBlocks: [],
  docsUrl: null,
  allowedDomains: [],
  watchedContracts: [],
  community: null,
  tokenModeAsk: null,
}
