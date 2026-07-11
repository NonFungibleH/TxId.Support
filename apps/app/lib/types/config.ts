// "demo" is a hand-provisioned full-access plan used while onboarding early
// users manually (and for our own accounts) before paid pricing is set.
export type Plan = "free" | "starter" | "pro" | "enterprise" | "custom" | "demo"

export const PLAN_CHAIN_LIMITS: Record<Plan, number> = {
  free:       1,
  starter:    1,        // legacy
  pro:        1,
  enterprise: Infinity,
  custom:     Infinity,
  demo:       Infinity,
}

export const PLAN_CONV_LIMITS: Record<Plan, number> = {
  free:       150,      // trial tier — enough to evaluate, then contact us
  starter:    200,      // legacy
  pro:        2500,     // legacy / internal
  enterprise: Infinity,
  custom:     Infinity,
  demo:       Infinity,
}

export const PLAN_LABELS: Record<Plan, string> = {
  free:       "Free",
  starter:    "Starter",
  pro:        "Pro",
  enterprise: "Enterprise",
  custom:     "Custom",
  demo:       "Demo",
}

// Every plan that is NOT the free trial. Used to gate paid-only behaviour
// such as hiding the "Powered by TxID Support" badge and suppressing upsell.
export const PAID_PLANS: Plan[] = ["starter", "pro", "enterprise", "custom", "demo"]

/** True for any paid/hand-provisioned plan (i.e. not the free trial). */
export function isPaidPlan(plan: Plan): boolean {
  return PAID_PLANS.includes(plan)
}

export const SUPPORTED_CHAINS = [
  { id: "0xaa36a7", name: "Sepolia (Testnet)",  explorer: "sepolia.etherscan.io" },
  { id: "0x1",      name: "Ethereum",          explorer: "etherscan.io" },
  { id: "0x2105",   name: "Base",              explorer: "basescan.org" },
  { id: "0x38",     name: "BNB Chain",         explorer: "bscscan.com" },
  { id: "0x89",     name: "Polygon",           explorer: "polygonscan.com" },
  { id: "0xa4b1",   name: "Arbitrum",          explorer: "arbiscan.io" },
  { id: "0xa",      name: "Optimism",          explorer: "optimistic.etherscan.io" },
  { id: "0xa86a",   name: "Avalanche",         explorer: "snowtrace.io" },
  { id: "solana",   name: "Solana",            explorer: "solscan.io" },
] as const

export type ChainId = (typeof SUPPORTED_CHAINS)[number]["id"]

// Chains kept in the integration but temporarily hidden from pickers
// (existing configs keep working; new selections are EVM-only for now).
const PAUSED_CHAINS = new Set<string>(["solana"])

/** Chains offered in chain pickers — SUPPORTED_CHAINS minus paused ones. */
export const SELECTABLE_CHAINS = SUPPORTED_CHAINS.filter(c => !PAUSED_CHAINS.has(c.id))

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

export const PERSONAS = ["concise", "friendly", "professional", "technical", "degen", "supportive"] as const
export type Persona = (typeof PERSONAS)[number]

export const PERSONA_LABELS: Record<Persona, { name: string; tagline: string }> = {
  concise:      { name: "Concise",      tagline: "Direct answers, no filler" },
  friendly:     { name: "Friendly",     tagline: "Warm and approachable" },
  professional: { name: "Professional", tagline: "Formal and precise" },
  technical:    { name: "Technical",    tagline: "Data-first, cites sources" },
  degen:        { name: "Degen",        tagline: "Crypto-native and casual, facts still exact" },
  supportive:   { name: "Supportive",   tagline: "Patient and reassuring for stressed users" },
}

export const FONT_SCALES = ["sm", "md", "lg", "xl"] as const
export type FontScale = (typeof FONT_SCALES)[number]
// Uniform zoom applied to the whole widget so text + spacing scale together.
// "md" = 1.0 is the default and a no-op (existing widgets unchanged).
export const FONT_SCALE_VALUE: Record<FontScale, number> = { sm: 0.9, md: 1.0, lg: 1.12, xl: 1.25 }
export const FONT_SCALE_LABEL: Record<FontScale, string> = { sm: "Small", md: "Default", lg: "Large", xl: "Extra large" }

export interface BrandingConfig {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  inputTextColor?: string | null  // colour of what the user types; falls back to auto-contrast with the background
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
  fontScale?: FontScale
}

export interface TokenConfig {
  address: string
  chain: ChainId
  dexUrl: string | null
  symbol: string | null
  name: string | null
  // Whether to show the token card in the widget's Content tab. The token still
  // powers price, the buy link, and token-aware answers regardless. Undefined =
  // shown (backward-compatible default).
  showInWidget?: boolean
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

export interface AuditEntry {
  id: string
  auditor: string       // e.g. "Hacken", "CertiK"
  url: string           // link to the published report on the auditor's site
  date?: string | null  // e.g. "2024-01" — optional
}

export interface ProjectConfig {
  branding: BrandingConfig
  token: TokenConfig | null
  chains: ChainId[]
  contentBlocks: ContentBlock[]
  docsUrl: string | null
  allowedDomains: string[]
  watchedContracts: WatchedContract[]
  audits?: AuditEntry[]
  community: CommunityConfig | null
  tokenModeAsk: string | null
  previewConfirmed: boolean
  notificationEmail?: string | null
  webhookUrl?: string | null
  plan?: Plan
  telegramBotToken?: string | null
  telegramBotUsername?: string | null
}

/**
 * Pick a readable text colour (near-black or near-white) for a given background,
 * using relative luminance. Used as the fallback for the widget input text when
 * no explicit inputTextColor is set, so typed text is never invisible.
 */
export function autoInputTextColor(backgroundColor: string): string {
  const hex = backgroundColor.replace("#", "")
  const full = hex.length === 3 ? hex.split("").map(c => c + c).join("") : hex
  const r = parseInt(full.slice(0, 2), 16) || 0
  const g = parseInt(full.slice(2, 4), 16) || 0
  const b = parseInt(full.slice(4, 6), 16) || 0
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#111827" : "#ffffff"
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
