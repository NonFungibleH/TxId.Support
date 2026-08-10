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
  free:       150,      // trial tier - enough to evaluate, then contact us
  starter:    200,      // legacy
  pro:        2500,     // legacy / internal
  enterprise: Infinity,
  custom:     Infinity,
  demo:       Infinity,
}

/**
 * User turns allowed in ONE conversation before the bot escalates to a human.
 *
 * The cap exists so a runaway or abusive session can't spend without bound, but
 * a flat 10 is wrong for a hand-provisioned customer: a genuine diagnosis
 * ("which transaction?", "what did it cost?", "why did it fail?", "what do I do
 * now?") walks through several turns, and hitting the wall mid-conversation
 * hands a real user to a human for no reason. Paid, hand-provisioned tiers get
 * room; the free tier stays tight because it is the open abuse surface.
 *
 * The PUBLIC demo key is stricter still and is NOT covered here: it uses
 * CHAT_LIMITS.demoSessionMessages, applied ahead of this table.
 */
export const PLAN_SESSION_MESSAGE_LIMITS: Record<Plan, number> = {
  free:       10,
  starter:    10,
  pro:        20,
  enterprise: 40,
  custom:     40,
  // REACHABLE since the cap split (2026-08-07): the route's hard cap now keys
  // on the public demo key and publicDemo projects only, so plan "demo",
  // hand-provisioned pilots and our own accounts, reads this table. 40 is
  // invisible to a genuine tester and still bounds a runaway session; the
  // daily spend guard is the real backstop behind it.
  demo:       40,
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
// such as hiding the "Powered by TxID" badge and suppressing upsell.
export const PAID_PLANS: Plan[] = ["starter", "pro", "enterprise", "custom", "demo"]

/** True for any paid/hand-provisioned plan (i.e. not the free trial). */
export function isPaidPlan(plan: Plan): boolean {
  return PAID_PLANS.includes(plan)
}

export const SUPPORTED_CHAINS = [
  { id: "0x1",      name: "Ethereum",          explorer: "etherscan.io" },
  { id: "0x2105",   name: "Base",              explorer: "basescan.org" },
  { id: "0x38",     name: "BNB Chain",         explorer: "bscscan.com" },
  { id: "0x89",     name: "Polygon",           explorer: "polygonscan.com" },
  { id: "0xa4b1",   name: "Arbitrum",          explorer: "arbiscan.io" },
  { id: "0xa",      name: "Optimism",          explorer: "optimistic.etherscan.io" },
  { id: "0xa86a",   name: "Avalanche",         explorer: "snowtrace.io" },
  { id: "0xa729",   name: "Etherlink",         explorer: "explorer.etherlink.com" },
  { id: "aptos",    name: "Aptos",             explorer: "explorer.aptoslabs.com" },
  { id: "solana",   name: "Solana",            explorer: "solscan.io" },
  { id: "0xaa36a7", name: "Sepolia (Testnet)",  explorer: "sepolia.etherscan.io" },
] as const

export type ChainId = (typeof SUPPORTED_CHAINS)[number]["id"]

// Chains kept in the integration but temporarily hidden from pickers
// (existing configs keep working; new selections are EVM-only for now).
const PAUSED_CHAINS = new Set<string>([
  "solana",
])

/** Chains offered in chain pickers - SUPPORTED_CHAINS minus paused ones. */
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

/**
 * How big the floating PANEL is, independent of how big the TEXT is.
 *
 * WHY BOTH EXIST: font scale zooms the widget's contents, so a bigger font on
 * the same 380x560 frame just means less fits. This resizes the frame itself
 * and leaves the text alone. The two multiply, because a larger font in a
 * larger panel is a legitimate combination.
 *
 * THE DEFAULT IS "large", NOT "standard". The embed's base 380x560 was chosen
 * for a floating helper on a marketing page; on a dense full-bleed trading
 * interface at 1920px it reads as a phone stuck to the corner. "standard" is
 * kept so anyone who wants the old size can ask for it, but nobody should have
 * to find a setting to stop the widget looking like an afterthought.
 *
 * Desktop only. Below 440px the panel is already a full-width bottom sheet, and
 * the embed ignores resize messages there.
 */
export const WIDGET_SIZES = ["standard", "large", "xl"] as const
export type WidgetSize = (typeof WIDGET_SIZES)[number]
export const DEFAULT_WIDGET_SIZE: WidgetSize = "large"
/** Multiplier on the embed's base 380x560. "standard" is a no-op. */
export const WIDGET_SIZE_VALUE: Record<WidgetSize, number> = { standard: 1.0, large: 1.18, xl: 1.38 }
export const WIDGET_SIZE_LABEL: Record<WidgetSize, { name: string; dims: string }> = {
  standard: { name: "Standard", dims: "380 x 560" },
  large:    { name: "Large",    dims: "448 x 661" },
  xl:       { name: "Extra large", dims: "524 x 773" },
}

/**
 * Beta programme: the same assistant, running for testers rather than users.
 *
 * NOT A MODE. `projectMode` values REPLACE each other, so a beta mode would
 * swap out support mode and take the transaction diagnosis with it, which is
 * the most valuable thing a tester can be given. This layers ON TOP, the way
 * `incident` and `subaccounts` already do.
 *
 * The two behaviours that are genuinely different in a beta:
 *
 * 1. IT INTRODUCES ITSELF. A tester arrives with no idea what they are meant
 *    to do. Waiting to be clicked wastes the only moment their attention is
 *    guaranteed.
 *
 * 2. FEEDBACK IS RECORDED, NOT ANSWERED. "The fee display is confusing" is not
 *    a question, and a support assistant will helpfully explain the fee
 *    display, which is exactly wrong. Feedback needs a deliberate act, not
 *    intent-guessing: a button, so nothing has to be inferred.
 */
export interface BetaConfig {
  enabled: boolean
  /** Open the panel unprompted on a tester's first visit. */
  autoOpen?: boolean
  /** Offer the Feedback mode: opinions, suggestions, reactions. */
  feedback?: boolean
  /**
   * Offer the Bug mode: something is broken.
   *
   * SEPARATE FROM FEEDBACK, because they are separate jobs. A protocol running
   * a design review wants opinions and no bug queue; one hardening a release
   * wants the opposite. Undefined INHERITS feedback, so every project
   * configured before bug reports existed keeps behaving exactly as it did.
   */
  bugReports?: boolean
  /** Greeting used when it opens itself. Falls back to the welcome message. */
  intro?: string | null
  /** ISO date. Betas end, and a stale "welcome to the beta" is embarrassing. */
  endsAt?: string | null
}

/**
 * Which tester controls a project offers. Undefined `bugReports` inherits
 * `feedback` so existing projects are unchanged by the split.
 */
export function betaControls(
  beta: { feedback?: boolean; bugReports?: boolean } | null | undefined,
): { feedback: boolean; bugs: boolean; any: boolean } {
  const feedback = beta?.feedback === true
  const bugs = beta?.bugReports ?? feedback
  return { feedback, bugs, any: feedback || bugs }
}

/**
 * Resolves expiry ON READ, like `activeStatusNotice`. A programme that ended
 * stops behaving like a beta the moment it ends, rather than when a job
 * eventually notices.
 */
export function activeBeta(config: { beta?: BetaConfig } | null | undefined): BetaConfig | null {
  const beta = config?.beta
  if (!beta?.enabled) return null
  if (beta.endsAt) {
    const ends = Date.parse(beta.endsAt)
    if (Number.isFinite(ends) && ends <= Date.now()) return null
  }
  return beta
}

export interface BrandingConfig {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  inputTextColor?: string | null  // colour of what the user types; falls back to auto-contrast with the background
  // Hairline around the widget panel. Without it the panel dissolves into a
  // dark host page: the background colour is often close to the site's own,
  // so there is no edge to read. Null falls back to a low-opacity tint of the
  // primary colour, which suits most brands without needing to be set.
  borderColor?: string | null
  font: SupportedFont
  logoUrl: string | null
  position: "bottom-right" | "bottom-left" | "inline"
  theme: "dark" | "light"
  persona: Persona
  customTone?: string | null
  agentName?: string | null
  agentIconUrl?: string | null
  websiteUrl?: string | null
  welcomeMessage?: string | null
  language?: string | null
  fontScale?: FontScale
  // Size of the floating panel itself, NOT of its text. Undefined = "standard",
  // so every existing embed is unchanged.
  widgetSize?: WidgetSize
  // Hide the wallet-connect pill in the widget header. For deployments where
  // wallet context adds nothing (e.g. a product's own support bot answering
  // docs questions). Undefined = shown (backward-compatible default).
  hideWallet?: boolean
  /**
   * Standing disclaimer under the chat composer and on every escalation.
   *
   * UNSET MEANS THE DEFAULT TEXT, NOT SILENCE. A disclaimer nobody remembers
   * to switch on is worth nothing, so this defaults to present and a protocol
   * has to deliberately clear it. Empty string is the explicit opt-out, for
   * teams whose own legal wording already sits on the page.
   */
  disclaimer?: string | null
}

/** Shown when a project has not set its own. Deliberately short: a long
 *  disclaimer is scrolled past, and this has to survive in a chat widget. */
export const DEFAULT_DISCLAIMER =
  "Informational only, not financial advice."

/** Resolve what to show. Undefined/null take the default; "" means off. */
export function resolveDisclaimer(branding: { disclaimer?: string | null } | undefined | null): string {
  const raw = branding?.disclaimer
  if (raw === undefined || raw === null) return DEFAULT_DISCLAIMER
  return raw.trim()
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
  // Aptos only: an account can host many modules; when set, contract tools
  // scope to this single module instead of the account's full module list.
  moduleName?: string
  errorGlossary?: ErrorGlossaryEntry[]
  abi?: string
  abiSource?: "explorer" | "uploaded"
}

export type ContentBlockType = "video" | "text" | "tokenomics" | "link" | "image" | "html" | "social" | "faq" | "dexscreener" | "docs"

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
  date?: string | null  // e.g. "2024-01" - optional
}

// "Actions": wallet-executed transactions prepared by the AI, signed by the
// user. Off by default; per-function allowlist; paid plans only (demo and
// publicDemo projects are always excluded, enforced server-side).
export interface ActionsFunctionRule {
  fn: string
  // Set when the function pulls an ERC-20 (e.g. lock(amount)): which token to
  // approve and which argument index carries the human amount. No ABI can
  // reveal this, so the protocol annotates it when enabling the function.
  approval?: { token: string; amountArg: number }
}

export interface ActionsConfig {
  enabled: boolean
  /** contractId → enabled write functions (static args, non-payable only). */
  allowedFunctions: Record<string, ActionsFunctionRule[]>
  /** Per-swap USD ceiling. 0 = swaps disabled (contract actions only). */
  maxSwapUsd: number
  enabledAt?: string
}

export const ACTIONS_MAX_SWAP_USD_DEFAULT = 2000
export const ACTIONS_MAX_SWAP_USD_CEILING = 25000

// Escalation integrations. Secrets - NEVER add to the widget-config publicConfig
// object, and never pass raw to a client component (derive {configured} booleans
// server-side, like telegramBotToken).
export interface Integrations {
  slack?:    { webhookUrl: string; enabled: boolean }
  discord?:  { webhookUrl: string; enabled: boolean }
  telegram?: { chatId: string; enabled: boolean }        // reuses the project's connected bot token
  linear?:   { apiKey: string; teamId: string; enabled: boolean }
  github?:   { token: string; repo: string; enabled: boolean }  // repo = "owner/name"
  jira?:     { domain: string; email: string; apiToken: string; projectKey: string; enabled: boolean }
}

export type IntegrationTarget = "slack" | "discord" | "telegram" | "linear" | "github" | "jira"

/**
 * Protocols that keep each user's funds in a per-user account OBJECT rather
 * than in the wallet itself: perps venues, margin venues, anything with a
 * subaccount. Those users have two addresses that are not interchangeable, and
 * meeting the second one unlabelled halfway through a conversation is how
 * "why is a different address showing as connected?" happens.
 *
 * OFF BY DEFAULT and deliberately so. Most protocols have no such concept, and
 * showing a second address there would invent one the user does not have. The
 * label and the resolver come from the protocol adapter in `packages/aptos`,
 * so enabling this only decides whether we look.
 */
export interface SubaccountsConfig {
  enabled: boolean
}

/**
 * Automatic re-crawl of the documentation.
 *
 * DAILY IS THE DEFAULT WHEN ENABLED, not weekly. Change detection means a run
 * only re-embeds pages that actually moved, so the cost of a run is fetching
 * rather than embedding, and the difference between daily and weekly is close
 * to nothing. Under-scheduling out of caution buys staleness for no saving.
 */
export interface DocsSyncConfig {
  enabled: boolean
  frequency: "daily" | "weekly"
}

export const DOCS_SYNC_INTERVAL_MS: Record<DocsSyncConfig["frequency"], number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
}

/**
 * A protocol's own status notice, carried by the assistant.
 *
 * FRAMING, AND IT MATTERS IN EVERY STRING BELOW: this is a control the
 * PROTOCOL uses to speak to its own users about its own service. It is not an
 * emergency switch for TxID, and nothing here should imply the assistant is
 * broken or that TxID is having a problem. The customer is announcing
 * something about their product, through a channel their users already have
 * open. Copy says "your protocol", "your users", "your message".
 *
 * WHY IT EARNS ITS PLACE: without it, an assistant answering from yesterday's
 * documentation is at its most confident exactly when the protocol's own
 * position has changed. "Withdrawals settle in 24 hours" is a good answer on
 * Monday and a harmful one on Tuesday, and only the protocol knows which day
 * it is.
 */
export type IncidentLevel =
  /** Your message is shown. The assistant still answers everything. */
  | "notice"
  /** The assistant holds back on the affected topics and gives your message instead. */
  | "restricted"
  /** The assistant gives only your message. */
  | "announcement_only"

export interface IncidentConfig {
  level: IncidentLevel
  /** Your own words. Users read this verbatim, and the assistant never edits it. */
  message: string
  /**
   * What is affected, in your users' vocabulary ("withdrawals", "the APT
   * market"). SCOPE MATTERS: "withdrawals are paused" is actionable, and
   * "something is wrong" causes a bank run. Empty means everything.
   */
  topics?: string[]
  raisedAt: string
  raisedBy?: string | null
  /**
   * When it comes down by itself. NOT optional in practice: a message left up
   * for three weeks teaches users to ignore your messages, which costs you the
   * channel exactly when you next need it.
   */
  expiresAt?: string | null
}

export const INCIDENT_LEVEL_LABEL: Record<IncidentLevel, string> = {
  notice: "Show my message",
  restricted: "Hold back on affected topics",
  announcement_only: "Only give my message",
}

export const INCIDENT_LEVEL_HELP: Record<IncidentLevel, string> = {
  notice: "Your users see your message, and the assistant carries on answering everything as normal.",
  restricted: "The assistant keeps helping with everything unrelated, and gives only your message on the topics you name. Usually the one you want.",
  announcement_only: "The assistant sets everything else aside and gives only your message.",
}

/**
 * The incident as it stands right now, or null.
 *
 * Expiry is resolved HERE rather than by a scheduled job, so a lapsed notice
 * stops being shown the moment it lapses, even if nothing has run since.
 */
export function activeStatusNotice(config: { incident?: IncidentConfig | null } | null | undefined): IncidentConfig | null {
  const inc = config?.incident
  if (!inc || !inc.message?.trim()) return null
  if (inc.expiresAt && Date.parse(inc.expiresAt) < Date.now()) return null
  return inc
}

export interface ProjectConfig {
  branding: BrandingConfig
  token: TokenConfig | null
  chains: ChainId[]
  contentBlocks: ContentBlock[]
  docsUrl: string | null
  allowedDomains: string[]
  /**
   * Explicit opt-out from the go-live domain requirement, for the genuine
   * cases: a Telegram-only project with no website, or an assistant embedded
   * across many domains. A CHOICE the customer records, never a silent
   * bypass, so an unrestricted key is always someone's decision.
   */
  allowUnrestrictedKey?: boolean
  watchedContracts: WatchedContract[]
  audits?: AuditEntry[]
  community: CommunityConfig | null
  /**
   * Curated starter questions shown as chips in the widget. When set, these
   * replace the AI-generated follow-up suggestions, so the team controls
   * exactly what is offered and no chip can propose a feature that does not
   * exist. Empty/unset keeps the AI-generated behaviour.
   */
  suggestedQuestions?: string[]
  tokenModeAsk: string | null
  previewConfirmed: boolean
  notificationEmail?: string | null
  webhookUrl?: string | null
  plan?: Plan
  // Marks OUR own public-demo project (the one the marketing site's demo key
  // points at). Exempts it from the per-customer domain allowlist and enables
  // the /check "try it live" protocol scoping, without changing its plan - so
  // it can stay on "custom". Only ever set on our own project, via /admin.
  publicDemo?: boolean
  actions?: ActionsConfig
  integrations?: Integrations
  /**
   * Greet a connecting wallet with what is actually happening on their
   * account, instead of "describe your issue". ON by default: the alternative
   * is a blank prompt that makes the user diagnose themselves first.
   */
  incident?: IncidentConfig | null
  proactiveOpener?: { enabled: boolean }
  docsSync?: DocsSyncConfig
  subaccounts?: SubaccountsConfig
  /** Beta programme. Layers on top of support mode, never replaces it. */
  beta?: BetaConfig
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
