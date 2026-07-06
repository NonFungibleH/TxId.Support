export type Plan = "free" | "starter" | "pro" | "enterprise" | "custom"

export const PLAN_CHAIN_LIMITS: Record<Plan, number> = {
  free:       1,
  starter:    1,        // legacy
  pro:        1,
  enterprise: Infinity,
  custom:     Infinity,
}

export const PLAN_CONV_LIMITS: Record<Plan, number> = {
  free:       50,       // trial tier — enough to evaluate, then contact us
  starter:    200,      // legacy
  pro:        2500,     // legacy / internal
  enterprise: Infinity,
  custom:     Infinity,
}

export const PLAN_LABELS: Record<Plan, string> = {
  free:       "Free",
  starter:    "Starter",
  pro:        "Pro",
  enterprise: "Enterprise",
  custom:     "Custom",
}

export const PAID_PLANS: Plan[] = ["starter", "pro", "enterprise", "custom"]

export const SUPPORTED_CHAINS = [
  { id: "0xaa36a7", name: "Sepolia (Testnet)",  explorer: "sepolia.etherscan.io" },
  { id: "0x1",      name: "Ethereum",          explorer: "etherscan.io" },
  { id: "0x2105",   name: "Base",              explorer: "basescan.org" },
  { id: "0x38",     name: "BNB Chain",         explorer: "bscscan.com" },
  { id: "0x89",     name: "Polygon",           explorer: "polygonscan.com" },
  { id: "0xa4b1",   name: "Arbitrum",          explorer: "arbiscan.io" },
  { id: "0xa",      name: "Optimism",          explorer: "optimistic.etherscan.io" },
  { id: "solana",   name: "Solana",            explorer: "solscan.io" },
] as const

export type ChainId = (typeof SUPPORTED_CHAINS)[number]["id"]

export const SUPPORTED_FONTS = [
  "Inter", "Sora", "Space Mono", "DM Sans", "IBM Plex Mono", "Outfit",
] as const

export type SupportedFont = (typeof SUPPORTED_FONTS)[number]

export const SUPPORTED_LANGUAGES = [
  { code: "en",    label: "English" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "zh-TW", label: "Chinese (Traditional)" },
  { code: "ko",    label: "Korean" },
  { code: "vi",    label: "Vietnamese" },
  { code: "id",    label: "Indonesian" },
  { code: "ru",    label: "Russian" },
  { code: "tr",    label: "Turkish" },
  { code: "es",    label: "Spanish" },
  { code: "pt-BR", label: "Portuguese (Brazilian)" },
  { code: "ja",    label: "Japanese" },
  { code: "ar",    label: "Arabic" },
  { code: "fr",    label: "French" },
  { code: "de",    label: "German" },
  { code: "th",    label: "Thai" },
  { code: "fil",   label: "Filipino" },
] as const

export type SupportedLanguageCode = (typeof SUPPORTED_LANGUAGES)[number]["code"]

export const PERSONAS = ["concise", "friendly", "professional", "technical"] as const
export type Persona = (typeof PERSONAS)[number]

export const PERSONA_LABELS: Record<Persona, { name: string; tagline: string }> = {
  concise:      { name: "Concise",      tagline: "Direct answers, no filler" },
  friendly:     { name: "Friendly",     tagline: "Warm and approachable" },
  professional: { name: "Professional", tagline: "Formal and precise" },
  technical:    { name: "Technical",    tagline: "Data-first, cites sources" },
}

export interface BrandingConfig {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  font: SupportedFont
  logoUrl: string | null
  position: "bottom-right" | "bottom-left" | "inline"
  theme: "dark" | "light"
  persona: Persona
  agentName?: string | null
  agentIconUrl?: string | null
  websiteUrl?: string | null
  welcomeMessage?: string | null
  language?: string | null
}

export interface TokenConfig {
  address: string
  chain: ChainId
  dexUrl: string | null
  symbol: string | null
  name: string | null
}

export interface ErrorGlossaryEntry {
  error: string         // error or event name to match, e.g. "SlippageTooHigh" or "LockAdded"
  explanation: string   // plain-English description shown to the user
  kind?: "error" | "event"  // defaults to "error" for backwards compatibility
}

export interface WatchedContract {
  id: string
  name: string
  address: string
  chain: ChainId
  description: string
  errorGlossary?: ErrorGlossaryEntry[]
  abi?: string
  abiSource?: "explorer" | "uploaded"
}

export type ContentBlockType = "video" | "text" | "tokenomics" | "link" | "image" | "html" | "social" | "faq" | "dexscreener"

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
  previewConfirmed: boolean
  notificationEmail?: string | null
  webhookUrl?: string | null
  plan?: Plan
  telegramBotToken?: string | null
  telegramBotUsername?: string | null
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
    persona: "concise",
  },
  token: null,
  chains: ["0x1"],
  contentBlocks: [],
  docsUrl: null,
  allowedDomains: [],
  watchedContracts: [],
  community: null,
  tokenModeAsk: null,
  previewConfirmed: false,
}
