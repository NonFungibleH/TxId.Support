"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { nanoid } from "nanoid"
import DOMPurify from "dompurify"
import { ActionCard } from "./ActionCard"
import type { WalletActionPayload } from "./ActionCard"
import {
  SendIcon,
  MessageCircleIcon,
  InfoIcon,
  Loader2Icon,
  AlertCircleIcon,
  ExternalLinkIcon,
  ChevronDownIcon,
  X as XIcon,
  LogOut as LogOutIcon,
  ThumbsUp as ThumbsUpIcon,
  ThumbsDown as ThumbsDownIcon,
  BookOpen as BookOpenIcon,
  Copy as CopyIcon,
  Check as CheckIcon,
  ShieldAlert as ShieldAlertIcon,
} from "lucide-react"

// Human-readable status shown while the bot runs each tool. Kept in sync with
// TOOL_LABELS in packages/ai/src/tools.ts (duplicated here to avoid pulling the
// server-only ai package into the client bundle).
const TOOL_LABELS: Record<string, string> = {
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
  check_address_sanctions: "Screening address (OFAC)…",
  check_token_safety: "Screening token safety…",
  resolve_ens_name: "Resolving ENS name…",
  estimate_action: "Simulating the action…",
  prepare_swap: "Preparing your swap…",
  prepare_contract_action: "Preparing your transaction…",
}

// Aptos is a Move chain: a "contract" is a module and names resolve through ANS,
// not ENS. These override the EVM wording above on Aptos-only projects.
const APTOS_TOOL_LABELS: Record<string, string> = {
  get_wallet_approvals: "Checking token permissions…",
  get_contract_transactions: "Checking module activity…",
  get_contract_events: "Reading module event history…",
  get_contract_deployment: "Checking module publication…",
  get_contract_holdings: "Checking module holdings…",
  get_contract_state: "Reading module state…",
  get_contract_data: "Reading module data…",
  get_contract_info: "Checking the module on-chain…",
  get_contract_functions: "Reading module functions…",
  get_upgrade_history: "Checking module upgrade history…",
  resolve_ens_name: "Resolving .apt name…",
}

function toolLabel(name: string, aptosWording: boolean): string {
  if (aptosWording && APTOS_TOOL_LABELS[name]) return APTOS_TOOL_LABELS[name]
  return TOOL_LABELS[name] ?? "Looking up data…"
}

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrandingConfig {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  inputTextColor?: string | null
  borderColor?: string | null
  font: string
  logoUrl: string | null
  theme: "dark" | "light"
  agentName?: string | null
  agentIconUrl?: string | null
  fontScale?: "sm" | "md" | "lg" | "xl"
  hideWallet?: boolean
  widgetSize?: string
}

const FONT_SCALE_VALUE: Record<string, number> = { sm: 0.9, md: 1.0, lg: 1.12, xl: 1.25 }
/** Kept in sync with WIDGET_SIZE_VALUE in lib/types/config.ts by hand: this
 *  file is the public widget bundle and does not import from the dashboard. */
const WIDGET_SIZE_VALUE: Record<string, number> = { standard: 1.0, large: 1.18, xl: 1.38 }

/** Unambiguous by design: the model must never have to guess that this is
 *  feedback rather than a question. Kept verbatim in the beta prompt block. */
const FEEDBACK_OPENER = "I want to leave feedback on the beta."
/** Same contract as feedback: a fixed opener, so nothing has to be classified. */
const BUG_OPENER = "I want to report a bug."
/** Default is "large": the base 380x560 reads as small on a dense desktop app. */
const DEFAULT_WIDGET_SIZE = "large"

interface WatchedContract {
  id: string
  name: string
  address: string
  chain: string
  description: string
}

interface ContentBlockData {
  id: string
  type: string
  title: string
  content: Record<string, string> | unknown
  order: number
}

interface WidgetConfig {
  projectId: string
  projectName: string
  branding: BrandingConfig
  chains: string[]
  token: { symbol: string | null; chain: string; dexUrl: string | null; address: string; showInWidget?: boolean } | null
  watchedContracts: WatchedContract[]
  mode?: "support" | "token"
  community?: {
    discord: string | null
    twitter: string | null
    telegram: string | null
    website: string | null
    whitepaper: string | null
    announcement: string | null
  } | null
  tokenModeAsk?: string | null
  welcomeMessage?: string | null
  /** Team-curated starter chips. Non-empty overrides AI-generated follow-ups. */
  suggestedQuestions?: string[]
  subaccounts?: { enabled: boolean }
  /** Resolved server-side. Empty string means the protocol turned it off. */
  disclaimer?: string
  statusNotice?: { level: string; message: string; topics: string[] } | null
  contentBlocks?: ContentBlockData[]
  /** Paid/hand-provisioned plans hide the "Powered by TxID" badge. */
  hidePoweredBy?: boolean
  /** Actions: AI-prepared, user-signed transactions (opt-in, paid plans). */
  actions?: { enabled: boolean }
  /** Beta programme. Resolved server-side, so null means "not running one". */
  beta?: { autoOpen: boolean; feedback: boolean; intro?: string | null } | null
}

// Returns perceived luminance 0-1; > 0.5 = light background
function getBgLuminance(hex: string): number {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const bv = parseInt(hex.slice(5, 7), 16) / 255
    return 0.2126 * r + 0.7152 * g + 0.0722 * bv
  } catch { return 0 }
}

const SOCIAL_COLORS: Record<string, string> = {
  twitter:  "#000000",
  discord:  "#5865F2",
  telegram: "#229ED9",
  github:   "#333333",
  website:  "#6366f1",
}

function SocialIcon({ platform }: { platform: string }) {
  const cls = "size-3.5 shrink-0"
  if (platform === "twitter") return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.632 5.903-5.632Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  )
  if (platform === "discord") return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.11 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
    </svg>
  )
  if (platform === "telegram") return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
    </svg>
  )
  if (platform === "github") return (
    <svg className={cls} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  )
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )
}

function getVideoEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`
    }
    if (u.hostname.includes("loom.com") && u.pathname.startsWith("/share/")) {
      return `https://www.loom.com/embed/${u.pathname.replace("/share/", "")}`
    }
  } catch { /* ignore */ }
  return null
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  /** Tool currently being called - shown while Claude fetches blockchain data */
  toolCall?: string | null
  /** One-tap "switch network" prompt when the wallet is on the wrong chain */
  switchAction?: { chainId: string; chainName: string }
  /** "Review in wallet" card for an AI-prepared, user-signed transaction */
  walletAction?: WalletActionPayload
  /** Client-only line (e.g. a switch confirmation) - never persisted, not ratable */
  local?: boolean
  /** The instant wallet-connected note. A PLACEHOLDER: the opener replaces it. */
  connectNote?: boolean
  /** User's 👍/👎 on this assistant answer: 1 up, -1 down, 0/undefined none */
  feedback?: number
}

// ─── Token Mode types ─────────────────────────────────────────────────────────

interface DexPair {
  chainId: string
  priceUsd: string | null
  priceChange: { m5: number; h1: number; h6: number; h24: number } | null
  volume: { h24: number } | null
  liquidity: { usd: number } | null
  marketCap: number | null
  fdv: number | null
  baseToken: { address: string; symbol: string; name: string }
}

interface DexScreenerResponse {
  pairs: DexPair[] | null
}

// Map widget chain IDs (hex) to DexScreener chain slugs
const CHAIN_SLUG: Record<string, string> = {
  "0x1":    "ethereum",
  "0x2105": "base",
  "0x38":   "bsc",
  "0x89":   "polygon",
  "0xa4b1": "arbitrum",
  "0xa":    "optimism",
}

function formatUsd(n: number | null | undefined): string {
  if (n == null) return "-"
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (n >= 1_000_000)     return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)         return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(4)}`
}

function PriceSparkline({ priceChange }: { priceChange: DexPair["priceChange"] }) {
  if (!priceChange) return null
  // Synthesise 4-point series from percentage changes (m5, h1, h6, h24)
  const base = 100
  const p24 = base
  const p6  = p24  * (1 + (priceChange.h6  - priceChange.h24) / 100)
  const p1  = p6   * (1 + (priceChange.h1  - priceChange.h6)  / 100)
  const p5m = p1   * (1 + priceChange.m5                       / 100)
  const points = [p24, p6, p1, p5m]
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const W = 80, H = 28
  const coords = points
    .map((v, i) => `${(i / (points.length - 1)) * W},${H - ((v - min) / range) * H}`)
    .join(" ")
  const isUp = p5m >= p24
  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <polyline
        points={coords}
        fill="none"
        stroke={isUp ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Rich message renderer ───────────────────────────────────────────────────

// Markdown link, bold, inline code, a bare URL, or a bare long hex value
// (address, tx hash, or an Aptos addr::module path). Answers routinely carry
// explorer and docs links, so both link shapes have to render as real anchors
// instead of raw syntax.
const INLINE_RE = /(\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s<>()]+|0x[0-9a-fA-F]{20,}(?:::[A-Za-z_][A-Za-z0-9_]*)*)/g
const MD_LINK_RE = /^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)$/

const LONG_HEX_RE = /^0x[0-9a-fA-F]{20,}$/
const MODULE_PATH_RE = /^(0x[0-9a-fA-F]{20,})((?:::[A-Za-z_][A-Za-z0-9_]*)+)$/

/**
 * Display form for a long hex value: middle-truncated so a 66 char Aptos
 * address or tx hash cannot wrap across three lines and swamp the panel.
 * Returns null for anything short enough to show in full.
 */
function shortenHex(value: string): string | null {
  if (LONG_HEX_RE.test(value)) return `${value.slice(0, 8)}…${value.slice(-6)}`
  const mod = MODULE_PATH_RE.exec(value)
  if (mod) return `${mod[1].slice(0, 8)}…${mod[1].slice(-6)}${mod[2]}`
  return null
}

const CODE_STYLE: React.CSSProperties = {
  fontFamily: "monospace",
  fontSize: "0.85em",
  // Neutral grey reads as a code chip on a dark OR a light bubble;
  // the old black wash vanished on dark branding.
  background: "rgba(128,128,128,0.28)",
  padding: "1px 4px",
  borderRadius: "4px",
}

/** Truncated hex chip: full value on hover, and a tap copies the whole thing. */
function HexChip({ value, display }: { value: string; display: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    try {
      void navigator.clipboard?.writeText(value).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }).catch(() => { /* clipboard blocked: the title still shows the value */ })
    } catch { /* no clipboard API */ }
  }
  return (
    <code
      title={`${value}\n(click to copy)`}
      onClick={copy}
      style={{
        ...CODE_STYLE,
        cursor: "pointer",
        // Already short: keep it on one line, and clip rather than overflow the
        // bubble if a module name makes it long anyway.
        display: "inline-block",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        overflowWrap: "normal",
        verticalAlign: "bottom",
      }}
    >
      {copied ? "Copied" : display}
    </code>
  )
}

/** Short, human link text. A raw explorer URL is 100+ chars and wraps badly. */
function linkLabel(raw: string): string {
  try {
    const u = new URL(raw)
    const host = u.hostname.replace(/^www\./, "")
    if (host.endsWith("aptoslabs.com")) return "View on Aptos Explorer"
    const bare = raw.replace(/^https?:\/\//, "").replace(/\/$/, "")
    if (bare.length <= 44) return bare
    const seg = u.pathname.replace(/\/$/, "").split("/").filter(Boolean).pop()
    if (!seg) return host
    return `${host}/…/${shortenHex(seg) ?? seg}`
  } catch {
    return raw
  }
}

function InlineLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={href}
      style={{
        color: "inherit",
        textDecoration: "underline",
        textUnderlineOffset: "2px",
        overflowWrap: "anywhere",
      }}
    >
      {label}
    </a>
  )
}

function parseInline(text: string): React.ReactNode {
  const parts = text.split(INLINE_RE)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => {
        const mdLink = MD_LINK_RE.exec(part)
        if (mdLink) return <InlineLink key={i} href={mdLink[2]} label={mdLink[1]} />
        if (part.startsWith("http://") || part.startsWith("https://")) {
          // Trailing sentence punctuation is not part of the URL.
          const trailing = /[.,;:!?]+$/.exec(part)?.[0] ?? ""
          const url = trailing ? part.slice(0, -trailing.length) : part
          return (
            <span key={i}>
              <InlineLink href={url} label={linkLabel(url)} />
              {trailing}
            </span>
          )
        }
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          const inner = part.slice(1, -1)
          const short = shortenHex(inner.trim())
          if (short) return <HexChip key={i} value={inner.trim()} display={short} />
          return <code key={i} style={CODE_STYLE}>{inner}</code>
        }
        // Bare (un-backticked) address, hash, or addr::module path.
        const bareShort = shortenHex(part)
        if (bareShort) return <HexChip key={i} value={part} display={bareShort} />
        return part
      })}
    </>
  )
}

function MessageContent({
  text,
  primaryColor,
}: {
  text: string
  primaryColor: string
}) {
  // Numbered-step badges sit on primaryColor, so their digit needs to contrast
  // with the brand colour, not with the bubble text colour.
  const onPrimary = getBgLuminance(primaryColor) > 0.5 ? "#111111" : "#ffffff"
  const blocks: React.ReactNode[] = []
  const lines = text.split("\n")
  let i = 0

  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (!trimmed) { i++; continue }

    // Fenced code block
    if (trimmed.startsWith("```")) {
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      i++
      blocks.push(
        <pre
          key={blocks.length}
          style={{
            fontFamily: "monospace",
            fontSize: "0.78em",
            background: "rgba(0,0,0,0.3)",
            padding: "8px 10px",
            borderRadius: "6px",
            overflowX: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
          }}
        >
          {codeLines.join("\n")}
        </pre>,
      )
      continue
    }

    // Markdown heading: render as a bold line, never as literal "##".
    if (/^#{1,4}\s/.test(trimmed)) {
      blocks.push(
        <p key={blocks.length} style={{ margin: 0, lineHeight: 1.45, fontWeight: 700 }}>
          {parseInline(trimmed.replace(/^#{1,4}\s+/, ""))}
        </p>,
      )
      i++
      continue
    }

    // Numbered list
    if (/^\d+[.)]\s/.test(trimmed)) {
      const steps: string[] = []
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i].trim())) {
        steps.push(lines[i].trim().replace(/^\d+[.)]\s/, ""))
        i++
      }
      blocks.push(
        <div key={blocks.length} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {steps.map((step, idx) => (
            <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "17px",
                  height: "17px",
                  borderRadius: "50%",
                  background: primaryColor,
                  color: onPrimary,
                  fontSize: "8px",
                  fontWeight: 700,
                  flexShrink: 0,
                  marginTop: "1px",
                  opacity: 0.85,
                }}
              >
                {idx + 1}
              </span>
              <span style={{ lineHeight: 1.5 }}>{parseInline(step)}</span>
            </div>
          ))}
        </div>,
      )
      continue
    }

    // Bullet list
    if (/^[-*•]\s/.test(trimmed)) {
      const items: string[] = []
      while (i < lines.length && /^[-*•]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*•]\s/, ""))
        i++
      }
      blocks.push(
        <div key={blocks.length} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {items.map((item, idx) => (
            <div key={idx} style={{ display: "flex", gap: "7px", alignItems: "flex-start" }}>
              <span style={{ opacity: 0.45, fontSize: "7px", lineHeight: "2.2", flexShrink: 0 }}>●</span>
              <span style={{ lineHeight: 1.5 }}>{parseInline(item)}</span>
            </div>
          ))}
        </div>,
      )
      continue
    }

    // Regular paragraph
    blocks.push(
      <p key={blocks.length} style={{ margin: 0, lineHeight: 1.55 }}>
        {parseInline(trimmed)}
      </p>,
    )
    i++
  }

  if (blocks.length === 0) return null

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {blocks}
    </div>
  )
}


// ─── FAQ accordion item ──────────────────────────────────────────────────────

function FaqItem({ q, a, secondaryColor, backgroundColor }: {
  q: string; a: string
  secondaryColor: string; backgroundColor: string
}) {
  const [open, setOpen] = useState(false)
  // The card sits on secondaryColor, so its text must contrast with that.
  const onSecondary = getBgLuminance(secondaryColor) > 0.5 ? "#111111" : "#ffffff"
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: secondaryColor }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-3 py-2.5 text-left gap-2"
      >
        <p className="text-xs font-medium flex-1" style={{ color: onSecondary }}>{q}</p>
        <ChevronDownIcon
          className={`size-3.5 shrink-0 opacity-50 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          style={{ color: onSecondary }}
        />
      </button>
      {open && (
        <div className="px-3 pb-2.5 border-t" style={{ borderColor: backgroundColor }}>
          <p className="text-[11px] opacity-75 leading-relaxed whitespace-pre-wrap pt-2" style={{ color: onSecondary }}>{a}</p>
        </div>
      )}
    </div>
  )
}

// ─── Wallet session helpers (module-level, no component state) ───────────────

type WalletSession = {
  setup: "connected" | "manual" | "skipped"
  address: string | null
  chainId: string | null
}

/** Aptos addresses are 66 chars, so never show one in full inside a chrome pill. */
/**
 * The user's account with the protocol, when the protocol keeps funds in a
 * per-user object rather than the wallet. `failed` must never render as
 * `none`: telling an active trader they have no account is worse than saying
 * nothing.
 */
type ProtocolAccountInfo =
  | { status: "ok"; protocol: string; label: string; address: string }
  | { status: "none"; protocol: string; label: string }
  | { status: "failed"; protocol: string; label: string }
  | { status: "off" }

function AddressRow({
  label, address, muted, accent,
}: { label: string; address: string; muted: string; accent: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: muted }}>
          {label}
        </span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(address).then(
              () => { setCopied(true); setTimeout(() => setCopied(false), 1500) },
              () => {},
            )
          }}
          className="flex shrink-0 items-center gap-1 text-[10px] transition-opacity hover:opacity-70"
          style={{ color: accent }}
        >
          {copied ? <CheckIcon className="size-3" /> : <CopyIcon className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Full, never truncated. A shortened address is not something a user can
          verify: lookalike scams match the first and last characters exactly. */}
      <code className="block break-all font-mono text-[10px] leading-relaxed">{address}</code>
    </div>
  )
}

/**
 * Both of the user's identities, on screen from the moment they connect.
 *
 * WHY: on a protocol with subaccounts the wallet the user connected is not the
 * account holding their positions. Meeting that second address for the first
 * time inside an answer reads as a hijack, and users have asked "why is a
 * different address showing as connected?". Naming both up front removes the
 * question rather than answering it.
 */
function IdentityBar({
  wallet, account, adaptiveText, accent, border,
}: {
  wallet: string
  account: ProtocolAccountInfo
  adaptiveText: string
  accent: string
  border: string
}) {
  const [open, setOpen] = useState(false)
  // "failed" says nothing rather than something wrong.
  if (account.status === "off" || account.status === "failed") return null

  const muted = `${adaptiveText}99`
  const summary =
    account.status === "ok"
      ? `Wallet ${shortAddr(wallet)} · ${account.protocol} ${account.label} ${shortAddr(account.address)}`
      : `Wallet ${shortAddr(wallet)} · no ${account.protocol} ${account.label} yet`

  return (
    <div className="shrink-0 border-b px-4 py-2" style={{ borderColor: border }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1.5 text-left transition-opacity hover:opacity-80"
        style={{ color: adaptiveText }}
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[10px]">{summary}</span>
        <ChevronDownIcon
          className="size-3 shrink-0 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : undefined, color: muted }}
        />
      </button>

      {open && (
        <div className="mt-2.5 space-y-3" style={{ color: adaptiveText }}>
          <AddressRow label="Your wallet" address={wallet} muted={muted} accent={accent} />
          {account.status === "ok" ? (
            <>
              <AddressRow
                label={`Your ${account.protocol} ${account.label}`}
                address={account.address}
                muted={muted}
                accent={accent}
              />
              <p className="text-[10px] leading-relaxed" style={{ color: muted }}>
                Your {account.label} is owned by your wallet and holds your positions and
                collateral. Both addresses are yours.
              </p>
            </>
          ) : (
            <p className="text-[10px] leading-relaxed" style={{ color: muted }}>
              This wallet has no {account.protocol} {account.label} yet, so it has never
              deposited or traded there.
            </p>
          )}
          <p className="flex items-start gap-1.5 text-[10px] leading-relaxed" style={{ color: muted }}>
            <ShieldAlertIcon className="mt-px size-3 shrink-0" />
            <span>
              Always check the full address. Scams use shortened addresses whose first and
              last characters match a real one.
            </span>
          </p>
        </div>
      )}
    </div>
  )
}

function shortAddr(a: string): string {
  return a.length > 14 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

function saveWalletSession(key: string, session: WalletSession) {
  try { sessionStorage.setItem(`txid_wallet_${key}`, JSON.stringify(session)) } catch { /* ignore */ }
}

function loadWalletSession(key: string): WalletSession | null {
  try {
    const raw = sessionStorage.getItem(`txid_wallet_${key}`)
    return raw ? (JSON.parse(raw) as WalletSession) : null
  } catch { return null }
}

function clearWalletSession(key: string) {
  try { sessionStorage.removeItem(`txid_wallet_${key}`) } catch { /* ignore */ }
}

// ─── Main component ──────────────────────────────────────────────────────────

export function WidgetApp({ onClose }: { onClose?: () => void } = {}) {
  const params = useSearchParams()
  const apiKey = params?.get("key") ?? ""
  const isPreview = params?.get("preview") === "1"
  // A bookmarklet launch: the owner deliberately opening the widget on a real
  // page. The one preview case where the beta arrival SHOULD play.
  const isFreshLaunch = params?.get("fresh") === "1"
  const previewToken = params?.get("pt") ?? undefined

  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>("chat")

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  // Preview sessions carry a "preview-" prefix so the dashboard can flag them
  // (like Telegram's "tg-") and the route can keep them out of the paid quota.
  const sessionId = useRef<string>(isPreview ? `preview-${nanoid()}` : nanoid())
  // WHO IS COMING BACK, as distinct from WHICH VISIT this is. sessionId must
  // stay per-visit because the message cap and the conversation count key on
  // it, so a durable one would lock a returning tester out for good. This is a
  // separate random value that survives a reload, scoped per project key so two
  // protocols on the same site never share it. Private mode and blocked storage
  // throw, and the correct outcome there is no visitor id at all rather than a
  // fresh one every load, which would inflate the count with ghosts.
  const visitorId = useRef<string | null>(null)
  if (visitorId.current === null && typeof window !== "undefined" && !isPreview) {
    try {
      const k = `txid_visitor_${apiKey}`
      let v = localStorage.getItem(k)
      if (!v) { v = nanoid(); localStorage.setItem(k, v) }
      visitorId.current = v
    } catch { visitorId.current = "" }
  }
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [protocolAccount, setProtocolAccount] = useState<ProtocolAccountInfo>({ status: "off" })
  const [walletConnecting, setWalletConnecting] = useState(false)
  const isSolanaProject = (config?.chains ?? []).includes("solana")
  const isAptosProject = (config?.chains ?? []).includes("aptos")
  const hasEvmChain = (config?.chains ?? []).some((c) => c !== "solana" && c !== "aptos")

  // Wallet setup flow: prompt → (connected | manual | skipped)
  const [walletSetup, setWalletSetup] = useState<"prompt" | "manual-input" | "connected" | "manual" | "skipped">("prompt")

  // What is actually happening on this wallet, fetched as soon as we know who
  // they are. Deliberately additive: the plain confirmation posts first and is
  // only replaced if the lookup returns something worth saying, so a slow or
  // failed read never leaves the widget looking stuck.
  // The host page's URL and viewport, posted by widget.js (only IT can see
  // them: this iframe's own location is app.txid.support). Attached to every
  // chat turn so findings and conversations carry WHERE the tester was.
  // Treated as data: length-capped here and validated again server-side.
  // Orientation is a ONE-TIME arrival, not a state of the conversation. It
  // used to render whenever no user message existed, so a tester who read it,
  // pressed Let's go and reopened later met the onboarding screen again, and
  // again: an inescapable loop back to the introduction. Remembered per
  // project in localStorage so it survives closing the panel and reloading
  // the page; if storage is unavailable it simply shows each visit rather
  // than breaking.
  const ORIENTED_KEY = `txid_oriented_${apiKey}`
  const [oriented, setOriented] = useState(false)
  useEffect(() => {
    try { if (localStorage.getItem(ORIENTED_KEY)) setOriented(true) } catch { /* private mode */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const markOriented = useCallback(() => {
    setOriented(true)
    try { localStorage.setItem(ORIENTED_KEY, "1") } catch { /* fine */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hostContext = useRef<{ url?: string; vw?: number; vh?: number }>({})
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string; vw?: number; vh?: number } | null
      if (d?.type !== "txid-host-context") return
      hostContext.current = {
        ...(typeof d.url === "string" ? { url: d.url.slice(0, 500) } : {}),
        ...(typeof d.vw === "number" ? { vw: d.vw } : {}),
        ...(typeof d.vh === "number" ? { vh: d.vh } : {}),
      }
    }
    window.addEventListener("message", onMsg)
    return () => window.removeEventListener("message", onMsg)
  }, [])

  const openerFetched = useRef<string | null>(null)
  useEffect(() => {
    // config.mode read inline: `isTokenMode` is declared far below and would
    // be evaluated in the dependency array during render, before it exists.
    if (!walletAddress || !chainId || config?.mode === "token") return
    const cacheKey = `${walletAddress}:${chainId}`
    if (openerFetched.current === cacheKey) return
    openerFetched.current = cacheKey
    let cancelled = false
    fetch(
      `/api/widget/opener?key=${encodeURIComponent(apiKey)}` +
      `&address=${encodeURIComponent(walletAddress)}&chainId=${encodeURIComponent(chainId)}`,
    )
      .then(r => (r.status === 204 ? null : r.json()))
      .then((d: { message?: string; chips?: string[] } | null) => {
        if (cancelled || !d?.message) return
        setMessages(prev => {
          // If they have already started typing or asked something, the moment
          // has passed: interrupting with an unprompted greeting is worse than
          // staying quiet.
          if (prev.some(m => m.role === "user")) return prev
          // REPLACE the wallet-connected placeholder rather than stacking a
          // third bot bubble. Three unprompted messages before the user has
          // said a word reads as spam; the address is in the header anyway.
          const opener = { id: nanoid(), role: "assistant" as const, content: d.message!, local: true }
          const idx = prev.findIndex(m => m.connectNote)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = opener
            return next
          }
          return [...prev, opener]
        })
        // Curated chips are the protocol's deliberate choice and keep winning;
        // these only fill the slot when nothing was curated.
        if (d.chips?.length) setSuggestions(d.chips)
      })
      .catch(() => { /* silence is the designed fallback */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress, chainId, apiKey, config?.mode])

  // The address the user connected is not the account their positions live in.
  // Resolve the second one as soon as we have the first, so both are on screen
  // before they ask a question rather than after they are confused by one.
  useEffect(() => {
    if (!walletAddress || config?.subaccounts?.enabled !== true) {
      setProtocolAccount({ status: "off" })
      return
    }
    let cancelled = false
    const url =
      `/api/widget/protocol-account?key=${encodeURIComponent(apiKey)}` +
      `&address=${encodeURIComponent(walletAddress)}`
    fetch(url)
      .then(r => (r.ok ? r.json() : { status: "failed" }))
      .then((d: ProtocolAccountInfo) => { if (!cancelled) setProtocolAccount(d) })
      // A failed lookup shows nothing. It must never render as "no account".
      .catch(() => { if (!cancelled) setProtocolAccount({ status: "off" }) })
    return () => { cancelled = true }
  }, [walletAddress, config?.subaccounts?.enabled, apiKey])

  // Ticket escalation state
  const [escalation, setEscalation] = useState<{ summary: string; reason: string } | null>(null)
  // The current transcript, readable from inside the SSE handler. The handler
  // closes over stale state, and reading it inside a setState updater would
  // mean a side effect that React may run twice.
  const messagesRef = useRef<Message[]>([])
  // THE TESTER PRESSED A BUTTON. We know this is feedback without asking the
  // model, so recording it does not depend on the model choosing to call a
  // tool. It said "Recorded for the team" and recorded nothing, twice, because
  // the whole chain hung on that one optional call.
  const awaitingFinding = useRef<"feedback" | "bug" | null>(null)
  const findingRecorded = useRef(false)
  const [ticketName, setTicketName] = useState("")
  const [ticketEmail, setTicketEmail] = useState("")
  // WHAT THE TRANSCRIPT CANNOT KNOW. The ticket already carries the full
  // conversation, the chain state and every lookup that failed, which is more
  // than a support form ever gets. What it cannot carry is the part the user
  // never thought to say: what they were trying to do, what they had already
  // tried, the order id in another tab. Optional on purpose, because a required
  // box here is a wall in front of someone who is already stuck.
  const [ticketNote, setTicketNote] = useState("")
  const [ticketSubmitting, setTicketSubmitting] = useState(false)
  const [ticketRef, setTicketRef] = useState<string | null>(null)
  const [ticketError, setTicketError] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualValue, setManualValue] = useState("")
  const [manualError, setManualError] = useState(false)
  // Surfaced in the header when a connect attempt fails, so a failure is never silent.
  const [walletError, setWalletError] = useState<string | null>(null)
  // Guards against overlapping connect attempts (double click, or a re-render).
  const connectingRef = useRef(false)
  // A pasted 66 char address would otherwise fill the header bar, so the field
  // shows a middle-truncated form whenever it is not being edited.
  const [manualFocused, setManualFocused] = useState(false)


  // Quick-reply suggestion chips
  const [suggestions, setSuggestions] = useState<string[]>([])
  // Team-curated chips from the dashboard. When present they are the ONLY
  // chips shown: the AI-generated follow-ups are suppressed, so a chip can
  // never offer a feature the protocol doesn't have.
  const curatedQuestions = (config?.suggestedQuestions ?? []).filter(q => q.trim().length > 0)
  const hasCurated = curatedQuestions.length > 0
  // Curated chips are always on offer (they are starter questions, not
  // follow-ups), so they persist rather than clearing after each turn.
  const visibleChips = hasCurated ? curatedQuestions : suggestions

  // Token mode state
  const [dexData, setDexData] = useState<DexPair | null>(null)
  const [dexLoading, setDexLoading] = useState(false)


  // ── Load config ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) {
      setConfigError("No API key provided")
      return
    }
    fetch(`/api/widget-config/${apiKey}${isPreview ? `?preview=1&pt=${previewToken ?? ""}` : ""}`, {
      signal: AbortSignal.timeout(12000),
    })
      .then((r) => r.json())
      .then((data: WidgetConfig | { error: string }) => {
        if ("error" in data) setConfigError(data.error)
        else {
          setConfig(data)
          // Tell the host loader what the brand colour is. The launcher button
          // lives on the host page and has no other way to know it, so without
          // this it stays TxID purple next to a differently-branded panel.
          const brand = data.branding?.primaryColor
          if (typeof window !== "undefined" && window.parent !== window && brand) {
            try { window.parent.postMessage({ type: "txid-brand", primaryColor: brand }, "*") } catch { /* host gone */ }
          }
          const isToken = data.mode === "token"
          setTab(isToken ? "trade" : "chat")
          if (!isToken) {
            const chains = data.chains ?? []
            const aptosOnly = chains.includes("aptos") && !chains.some((c) => c !== "aptos" && c !== "solana")
            const fallback = aptosOnly
              ? `Hi! I'm here to help with ${data.projectName}. Ask me about the protocol, its Move modules, or any transaction.`
              : `Hi! I'm here to help with ${data.projectName}. Ask me about the protocol, token, smart contracts, or transactions.`
            setMessages([
              {
                id: nanoid(),
                role: "assistant",
                // Beta introduction wins over the normal welcome: a tester
                // needs to be told what this IS and what to try, which is a
                // different job from greeting a customer who already knows.
                content: data.beta?.intro?.trim() || data.welcomeMessage?.trim() || fallback,
                // The greeting is not an answer, so it carries no 👍/👎.
                local: true,
              },
            ])
          }
        }
      })
      .catch(() => setConfigError("Failed to load widget config"))
  }, [apiKey, isPreview, previewToken])

  // ── Ask the embed (widget.js) to size the iframe. ───────────────────────────
  // TWO INDEPENDENT FACTORS, MULTIPLIED:
  //   fontScale  grows the CONTENTS, so the frame must grow too or a larger
  //              font simply means less fits inside the same 380x560.
  //   widgetSize grows the FRAME ONLY, for protocols whose page makes the
  //              default panel look small. The text stays where it was.
  // Only fontScale feeds the in-widget zoom below; widgetSize must never reach
  // it, or "bigger panel" would silently also mean "bigger text".
  useEffect(() => {
    const scale =
      (FONT_SCALE_VALUE[config?.branding?.fontScale ?? "md"] ?? 1) *
      (WIDGET_SIZE_VALUE[config?.branding?.widgetSize ?? DEFAULT_WIDGET_SIZE] ?? 1)
    if (scale !== 1 && typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "txid-resize", scale }, "*")
    }
  }, [config])

  // ── Beta programme: ask the embed to open itself ────────────────────────────
  // The DECISION is here because only the widget has read the project config;
  // the ENFORCEMENT is in widget.js, which owns the once-per-tab rule, the
  // mobile exclusion and the "not if they already opened it" check. Asking
  // twice is harmless: the embed ignores a repeat.
  useEffect(() => {
    if (!config?.beta?.autoOpen) return
    // Suppressed in the DASHBOARD preview (auto-opening while someone edits
    // branding would be maddening) but not for a bookmarklet launch, which
    // exists precisely to show the real arrival on a real page.
    if (isPreview && !isFreshLaunch) return
    if (typeof window === "undefined" || window.parent === window) return
    window.parent.postMessage("txid-autoopen", "*")
  }, [config, isPreview, isFreshLaunch])

  // ── Auto-scroll to latest message ───────────────────────────────────────
  // Chips and the ticket form shrink the scroller, so they scroll too: without
  // them the last line of an answer ends up hidden behind the chip row.
  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, visibleChips.length, escalation])

  // ── DexScreener polling ──────────────────────────────────────────────────
  useEffect(() => {
    if (config?.mode !== "token" || !config.token?.address) return

    async function fetchDex() {
      setDexLoading(true)
      try {
        const res = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${config!.token!.address}`
        )
        const data: DexScreenerResponse = await res.json()
        const targetChain = CHAIN_SLUG[config!.token!.chain ?? ""] ?? ""
        const pair = data.pairs?.find((p) => p.chainId === targetChain) ?? data.pairs?.[0] ?? null
        setDexData(pair)
      } catch {
        // silently fail - fallback state shown
      } finally {
        setDexLoading(false)
      }
    }

    fetchDex()
    const interval = setInterval(fetchDex, 30_000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config?.mode, config?.token?.address, config?.token?.chain])

  // ── Restore wallet session on mount (after config loads) ─────────────────
  useEffect(() => {
    if (!apiKey || !config) return
    const session = loadWalletSession(apiKey)
    if (!session) return

    // Only auto-restore manual addresses - never auto-call MetaMask (triggers popup)
    if (session.setup === "manual" && session.address) {
      setWalletAddress(session.address)
      setChainId(session.chainId ?? "0x1")
      setWalletSetup("manual")
      setTab("chat")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, config])

  // ── Manual address entry (for users with no injected wallet) ─────────────
  const submitManualAddress = useCallback(() => {
    const addr = manualValue.trim()
    const isEvmAddr = /^0x[0-9a-fA-F]{40}$/.test(addr)
    const isAptosAddr = isAptosProject && /^0x[0-9a-fA-F]{1,64}$/.test(addr)
    if (!isEvmAddr && !isAptosAddr) {
      setManualError(true)
      return
    }
    // 40-hex is valid on both EVM and Aptos: prefer the project's EVM chain and
    // treat it as Aptos only when the project has none. Longer hex is
    // unambiguously Aptos.
    const evmCid = (config?.chains ?? []).find((c) => c !== "solana" && c !== "aptos")
    const cid = isEvmAddr ? (evmCid ?? (isAptosProject ? "aptos" : "0x1")) : "aptos"
    setWalletAddress(addr)
    setChainId(cid)
    setWalletSetup("manual")
    saveWalletSession(apiKey, { setup: "manual", address: addr, chainId: cid })
    setMessages((prev) => [...prev, {
      id: nanoid(),
      role: "assistant",
      content: `Using ${shortAddr(addr)}. I can look up its balance and transactions now.`,
      local: true,
    }])
    setManualOpen(false)
    setManualValue("")
    setManualError(false)
    setTab("chat")
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualValue, config, apiKey])

  // ── Connect wallet ───────────────────────────────────────────────────────
  // ── Embedded wallet bridge ─────────────────────────────────────────────────
  // When the widget runs as a cross-origin iframe (embedded on a customer site),
  // injected wallet providers (Petra's window.aptos, MetaMask, Phantom) live in
  // the HOST page, not this iframe - so window.aptos is undefined here. The
  // loader (widget.js) relays connect requests over postMessage. On mount we ask
  // it which providers the host page can see, and connectWallet routes through it.
  const isEmbedded = typeof window !== "undefined" && window.parent !== window
  const [bridgeWallet, setBridgeWallet] = useState<{ aptos: boolean; evm: boolean; solana: boolean } | null>(null)

  useEffect(() => {
    if (!isEmbedded || typeof window === "undefined") return
    function onMsg(e: MessageEvent) {
      if (e.source !== window.parent) return
      const d = e.data as { type?: string; aptos?: boolean; evm?: boolean; solana?: boolean } | null
      if (d?.type === "txid-wallet-available") {
        setBridgeWallet({ aptos: !!d.aptos, evm: !!d.evm, solana: !!d.solana })
      }
    }
    window.addEventListener("message", onMsg)
    window.parent.postMessage({ type: "txid-wallet-detect" }, "*")
    return () => window.removeEventListener("message", onMsg)
  }, [isEmbedded])

  const connectViaBridge = useCallback((kind: "aptos" | "evm" | "solana"): Promise<{ address: string; chainId: string } | null> => {
    return new Promise((resolve) => {
      if (typeof window === "undefined") { resolve(null); return }
      const id = `wc_${Date.now()}_${Math.random().toString(36).slice(2)}`
      let settled = false
      function onMsg(e: MessageEvent) {
        if (e.source !== window.parent) return
        const d = e.data as { type?: string; id?: string; ok?: boolean; address?: string; chainId?: string } | null
        if (d?.type === "txid-wallet-result" && d.id === id && !settled) {
          settled = true
          window.removeEventListener("message", onMsg)
          clearTimeout(timer)
          resolve(d.ok && d.address ? { address: d.address, chainId: d.chainId ?? "" } : null)
        }
      }
      // Generous timeout - the host wallet popup can sit waiting for the user.
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        window.removeEventListener("message", onMsg)
        resolve(null)
      }, 120000)
      window.addEventListener("message", onMsg)
      window.parent.postMessage({ type: "txid-wallet-connect", provider: kind, id }, "*")
    })
  }, [])

  /**
   * Wallet connect diagnostics. Connect failures are invisible by nature (a
   * popup that never appears looks identical to a no-op), so every branch
   * reports what it saw. Prefixed so it is greppable in a customer's console.
   */
  const walletDiag = (what: string, detail?: unknown) => {
    try { console.info("[TxID wallet]", what, detail ?? "") } catch { /* console blocked */ }
  }

  /**
   * Read an address out of whatever a wallet's connect() resolves to. Petra has
   * shipped several shapes over time: a bare string, {address}, and an
   * AccountAddress object exposing toString/toStringLong. Returning null for
   * anything unrecognised keeps a malformed response from being stored as a
   * real connection.
   */
  const readAptosAddress = (acct: unknown): string | null => {
    const pick = (v: unknown): string | null => {
      if (typeof v === "string") return v.startsWith("0x") ? v : null
      if (v && typeof v === "object") {
        const o = v as { toStringLong?: () => string; toString?: () => string }
        if (typeof o.toStringLong === "function") { const r = o.toStringLong(); if (typeof r === "string" && r.startsWith("0x")) return r }
        if (typeof o.toString === "function") { const r = o.toString(); if (typeof r === "string" && r.startsWith("0x")) return r }
      }
      return null
    }
    // Look for an explicit address field FIRST, at either nesting level, before
    // coercing the container. Coercing first risks picking up a sibling that
    // also stringifies to 0x hex, notably publicKey, which is the same shape as
    // an address and silently yields a plausible but WRONG account.
    const container = acct as { address?: unknown; account?: { address?: unknown } } | null
    const explicit = pick(container?.address) ?? pick(container?.account?.address)
    if (explicit) return explicit
    // Only a bare string is trusted as the address itself.
    return typeof acct === "string" && acct.startsWith("0x") ? acct : null
  }

  // Injected-provider detection and the resulting connect target. Declared
  // before connectWallet so the callback and its dependency array can both
  // reference walletTarget.
  const hasPhantom = typeof window !== "undefined" && (
    !!(window as unknown as { phantom?: { solana?: unknown } }).phantom?.solana ||
    !!(window as unknown as { solana?: unknown }).solana
  )
  const hasMetaMask = typeof window !== "undefined" && "ethereum" in window
  const hasPetraLike = typeof window !== "undefined" && (
    !!(window as unknown as { petra?: unknown }).petra ||
    !!(window as unknown as { aptos?: unknown }).aptos
  )
  const hasMartian = typeof window !== "undefined" && !!(window as unknown as { martian?: unknown }).martian
  const hasAptosWallet = hasPetraLike || hasMartian
  /**
   * ONE source of truth for which wallet family Connect will actually open,
   * used by the label, the enabled check and the click handler so they can
   * never disagree.
   *
   * The previous rule was `isAptosProject && !(hasEvmChain && "ethereum" in
   * window)`, which meant a project watching BOTH Aptos and an EVM chain fell
   * through to the EVM path whenever MetaMask happened to be installed. On
   * such a project Petra was unreachable: the button opened MetaMask, or on an
   * Aptos-only wallet simply failed. An Aptos provider that is actually present
   * now wins for an Aptos project, because that is the chain the user is being
   * asked about.
   */
  const aptosProviderAvailable = hasAptosWallet || (isEmbedded && !!bridgeWallet?.aptos)
  const evmProviderAvailable = hasMetaMask || (isEmbedded && !!bridgeWallet?.evm)
  const walletTarget: "solana" | "aptos" | "evm" = isSolanaProject
    ? "solana"
    : isAptosProject
      ? "aptos"
      : "evm"
  /**
   * An Aptos project ALWAYS attempts Aptos first, and only falls back to EVM
   * from inside that branch if no Aptos path produced an address.
   *
   * The previous rule fell straight to EVM when an Aptos provider was not
   * visible AND an EVM wallet was. Embedded, that is the normal situation:
   * Petra does not inject into a cross-origin iframe, while MetaMask does. So
   * an Aptos trader clicking "Connect" ran eth_requestAccounts inside an
   * iframe, which MetaMask rejects immediately, producing an instant failure
   * and no popup. Preferring the chain the project is actually about, and
   * treating EVM as the fallback rather than the default, removes that.
   */
  const evmFallbackAllowed = hasEvmChain && evmProviderAvailable

  /**
   * Aptos Wallet Standard (AIP-62) discovery.
   *
   * Petra now tells us directly: "Direct usage of the PetraApiClient through
   * window.petra is deprecated, refer to the Aptos Wallet Standard". Under that
   * standard a wallet does not expose a window global at all: it registers
   * itself through an event handshake, and the app connects through the
   * wallet's own "aptos:connect" feature.
   *
   * Implemented directly rather than pulling in @aptos-labs/wallet-standard, so
   * the widget bundle stays small and dependency-free.
   */
  type StandardWallet = {
    name?: string
    features?: Record<string, { connect?: (...a: unknown[]) => Promise<unknown>; version?: string }>
  }
  const discoverStandardWallets = useCallback((): StandardWallet[] => {
    if (typeof window === "undefined") return []
    const found: StandardWallet[] = []
    const register = (w: StandardWallet | StandardWallet[]) => {
      for (const one of Array.isArray(w) ? w : [w]) if (one) found.push(one)
      return () => {}
    }
    try {
      // Wallets already registered push themselves when they see app-ready;
      // wallets that loaded first answer the register-wallet listener.
      const onRegister = (e: Event) => {
        const cb = (e as CustomEvent<(api: { register: typeof register }) => void>).detail
        if (typeof cb === "function") { try { cb({ register }) } catch { /* one bad wallet must not stop the rest */ } }
      }
      window.addEventListener("wallet-standard:register-wallet", onRegister)
      window.dispatchEvent(new CustomEvent("wallet-standard:app-ready", { detail: { register } }))
      window.removeEventListener("wallet-standard:register-wallet", onRegister)
    } catch { /* discovery unavailable */ }
    // Some builds also expose an array directly.
    const direct = (window as unknown as { aptosWallets?: StandardWallet[] }).aptosWallets
    if (Array.isArray(direct)) found.push(...direct)
    return found
  }, [])

  /**
   * One place that reports a failed connect. Each call site passes a distinct
   * STAGE so the on-screen message identifies which branch failed: a single
   * generic "could not connect" made every cause look identical and cost a lot
   * of debugging time. The stage is shown to the user in brackets on purpose,
   * so a screenshot alone is enough to diagnose it.
   */
  const failConnect = useCallback((stage: string, reason: string) => {
    // Embedded, a wallet extension cannot show its approval popup, so no
    // amount of retrying inside the panel will ever work. Offer the one thing
    // that always does: the same widget opened as a normal page.
    const topLevel = typeof window !== "undefined" && window.parent !== window
      ? ` To connect a wallet, open this assistant in its own tab: ${window.location.href}`
      : ""
    const msg = `${reason} You can paste your address in the box at the top instead, and I can still look up your balance and transactions.${topLevel} [${stage}]`
    walletDiag("connect failed", { stage, reason })
    setWalletError(msg)
    setMessages(prev => [...prev, { id: `wallet-err-${Date.now()}`, role: "assistant", content: msg, local: true }])
    setManualOpen(true)
  }, [])

  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined") return
    // A second click while the first attempt is in flight produced a duplicate
    // connect and a duplicate confirmation line in the transcript.
    if (connectingRef.current) { walletDiag("connect already in progress, ignoring"); return }
    connectingRef.current = true
    setWalletError(null)
    setWalletConnecting(true)
    walletDiag("connect requested", {
      target: walletTarget,
      embedded: isEmbedded,
      providers: {
        petra: typeof window !== "undefined" && !!(window as unknown as { petra?: unknown }).petra,
        aptos: typeof window !== "undefined" && !!(window as unknown as { aptos?: unknown }).aptos,
        martian: typeof window !== "undefined" && !!(window as unknown as { martian?: unknown }).martian,
        ethereum: typeof window !== "undefined" && "ethereum" in window,
      },
    })
    const applyConn = (address: string, chainId: string) => {
      setWalletAddress(address)
      setChainId(chainId)
      setWalletSetup("connected")
      saveWalletSession(apiKey, { setup: "connected", address, chainId })
      // A pill quietly changing in the header is easy to miss: confirm in the
      // thread so the user knows the wallet is actually in play.
      setMessages((prev) => [...prev, {
        id: nanoid(),
        role: "assistant",
        content: `Wallet connected: ${shortAddr(address)}.`,
        local: true,
        connectNote: true,
      }])
    }
    try {
      // Try the provider injected into THIS frame first - connecting directly
      // from the click keeps the user gesture, so the wallet popup actually
      // appears. Only when no provider is present here (embedded and the wallet
      // lives in the host page) do we delegate to the loader bridge.
      if (walletTarget === "solana") {
        type PhantomProvider = {
          connect: () => Promise<{ publicKey: { toString: () => string } }>
          isPhantom?: boolean
        }
        const phantom = (
          (window as unknown as { phantom?: { solana?: PhantomProvider } }).phantom?.solana ??
          (window as unknown as { solana?: PhantomProvider }).solana
        )
        if (phantom) { const resp = await phantom.connect(); applyConn(resp.publicKey.toString(), "solana"); return }
        if (isEmbedded) { const res = await connectViaBridge("solana"); if (res) { applyConn(res.address, res.chainId || "solana"); return } }
        failConnect("no-phantom", "No Solana wallet was detected.")
        return
      }
      if (walletTarget === "aptos") {
        /**
         * Try every injected Aptos handle in turn rather than picking one.
         *
         * window.petra is DEPRECATED: current Petra builds throw
         * "Direct usage of the PetraApiClient through window.petra is
         * deprecated" the moment connect() is called, so preferring it made an
         * installed, working wallet look broken. window.aptos is the handle
         * Petra still serves for the wallet standard, so it goes first, and a
         * throw from any single candidate falls through to the next instead of
         * ending the attempt.
         */
        let lastProviderError: string | null = null

        /**
         * EMBEDDED FIRST, via the host page.
         *
         * A wallet extension cannot show its approval popup for a cross-origin
         * iframe. Petra injects into the frame and registers there, so every
         * in-frame path LOOKS available, but connect() then never settles: no
         * popup, no resolve, no reject. That is the hang seen in the console
         * ("trying wallet standard Petra" and then silence).
         *
         * The loader running on the host page IS top level, so it can talk to
         * the wallet properly. Ask it first whenever we are embedded, and keep
         * the in-frame attempts only as a fallback for hosts running an older
         * loader without the bridge.
         */
        // Only ask the host if it ANSWERED the capability probe. A page that
        // embedded us with a bare iframe (the preview bookmarklet does exactly
        // that) has no loader listening, so asking it just burns the timeout.
        if (isEmbedded && bridgeWallet) {
          walletDiag("embedded: asking the host page first")
          const viaHost = await connectViaBridge("aptos")
          if (viaHost) { walletDiag("connected via host bridge"); applyConn(viaHost.address, viaHost.chainId || "aptos"); return }
          walletDiag("host bridge did not connect, falling back to in-frame")
          lastProviderError = "the page hosting this widget did not complete the wallet connection"
        } else if (isEmbedded) {
          walletDiag("embedded but host has no wallet bridge; in-frame attempts are unlikely to succeed")
        }

        // AIP-62: the path Petra's deprecation notice points at, and modern
        // builds register here INSTEAD of exposing a global.
        const standardWallets = discoverStandardWallets()
        walletDiag("wallet-standard wallets discovered", standardWallets.map(w => w.name ?? "unnamed"))
        for (const w of standardWallets) {
          const feature = w.features?.["aptos:connect"]
          if (typeof feature?.connect !== "function") continue
          try {
            walletDiag("trying wallet standard", w.name ?? "unnamed")
            // Call it ON the feature object. Pulling `connect` out into a bare
            // reference loses its `this`, and the wallet then never settles the
            // promise, which presents as the button hanging with no error at
            // all. Also raced against a timeout so a wallet that simply never
            // answers cannot wedge the UI forever.
            const res = await Promise.race([
              feature.connect(),
              // Short when embedded: an extension that cannot show a popup for
              // an iframe simply never answers, so waiting is pure dead air.
              new Promise((_, rej) => setTimeout(
                () => rej(new Error(isEmbedded
                  ? "the wallet did not respond inside the embedded panel"
                  : "the wallet did not respond within 60 seconds")),
                isEmbedded ? 6_000 : 60_000,
              )),
            ])
            walletDiag("wallet standard resolved", res)
            // Standard connect resolves { status, args: { address, ... } }.
            const payload = (res as { args?: unknown } | null)?.args ?? res
            const addr = readAptosAddress(payload)
            walletDiag("address extracted", {
              address: addr,
              payloadKeys: payload && typeof payload === "object" ? Object.keys(payload as object) : typeof payload,
            })
            if (addr) { walletDiag("connected via wallet standard", w.name ?? "unnamed"); applyConn(addr, "aptos"); return }
            walletDiag("wallet standard returned no address", res)
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e)
            walletDiag("wallet standard failed", { wallet: w.name, error: m })
            if (/reject|denied|cancel/i.test(m)) throw e
            lastProviderError = `${w.name ?? "wallet standard"}: ${m}`
          }
        }

        type AptosProvider = { connect: () => Promise<unknown> }
        const candidates: { name: string; provider: AptosProvider | undefined }[] = [
          { name: "window.aptos", provider: (window as unknown as { aptos?: AptosProvider }).aptos },
          { name: "window.martian", provider: (window as unknown as { martian?: AptosProvider }).martian },
          { name: "window.petra", provider: (window as unknown as { petra?: AptosProvider }).petra },
        ]
        for (const c of candidates) {
          if (!c.provider || typeof c.provider.connect !== "function") continue
          try {
            walletDiag("trying provider", c.name)
            const acct = await Promise.race([
              c.provider.connect(),
              new Promise((_, rej) => setTimeout(
                () => rej(new Error(isEmbedded ? "no response inside the embedded panel" : "no response")),
                isEmbedded ? 6_000 : 60_000,
              )),
            ])
            const addr = readAptosAddress(acct)
            if (addr) { walletDiag("connected via", c.name); applyConn(addr, "aptos"); return }
            walletDiag("provider returned no usable address", { via: c.name, acct })
            lastProviderError = "the wallet connected but returned no address"
          } catch (e) {
            const m = e instanceof Error ? e.message : String(e)
            walletDiag("provider failed", { via: c.name, error: m })
            // A deliberate dismissal should stop the loop: trying the next
            // handle would just pop a second prompt at someone who said no.
            if (/reject|denied|cancel/i.test(m)) throw e
            lastProviderError = `${c.name}: ${m}`
          }
        }
        if (isEmbedded) {
          const res = await connectViaBridge("aptos")
          if (res) { applyConn(res.address, res.chainId || "aptos"); return }
          // The widget is a cross-origin iframe and no Aptos wallet was
          // reachable through the host page either.
        }
        // Nothing Aptos-shaped answered. Only now consider an EVM wallet, and
        // only if the project actually watches an EVM chain.
        if (evmFallbackAllowed && "ethereum" in window) {
          walletDiag("no aptos path, falling back to EVM")
          const eth = (window as unknown as { ethereum: { request: (a: { method: string }) => Promise<string[]> } }).ethereum
          const accounts = await eth.request({ method: "eth_requestAccounts" })
          const chain = await eth.request({ method: "eth_chainId" }) as unknown as string
          if (accounts?.[0]) { applyConn(accounts[0], chain); return }
        }
        failConnect(
          lastProviderError ? "aptos-provider-failed" : "no-aptos-provider",
          lastProviderError
            ? `Your Aptos wallet did not complete the connection. ${standardWallets.length} standard wallet(s) seen. Last error, ${lastProviderError.slice(0, 130)}`
            : isEmbedded
              ? "No Aptos wallet answered. Wallet extensions often do not load inside an embedded panel."
              : "No Aptos wallet extension was detected.",
        )
        return
      }
      // EVM - window.ethereum (MetaMask and other injected wallets)
      if ("ethereum" in window) {
        const eth = (window as unknown as { ethereum: { request: (a: { method: string }) => Promise<string[]> } }).ethereum
        const accounts = await eth.request({ method: "eth_requestAccounts" })
        const chain = await eth.request({ method: "eth_chainId" }) as unknown as string
        applyConn(accounts[0], chain)
        return
      }
      if (isEmbedded) { const res = await connectViaBridge("evm"); if (res) { applyConn(res.address, res.chainId); return } }
      failConnect("no-evm-provider", "No wallet extension was detected in this page.")
    } catch (err) {
      // NEVER swallow this. A silent catch here made every failure look like
      // "the button does nothing": the fallback below is after the throw
      // point, so it was never reached, and the user got no message at all.
      const raw = err instanceof Error ? err.message : String(err)
      const rejected = /reject|denied|cancel/i.test(raw)
      walletDiag(rejected ? "user rejected the connect request" : "connect threw", err)
      failConnect(
        rejected ? "rejected" : "threw",
        rejected ? "You dismissed the wallet request." : `Your wallet reported: ${raw.slice(0, 140)}`,
      )
    } finally {
      connectingRef.current = false
      setWalletConnecting(false)
    }
  }, [apiKey, walletTarget, isEmbedded, bridgeWallet, connectViaBridge, failConnect, evmFallbackAllowed, discoverStandardWallets])

  // ── Disconnect wallet ────────────────────────────────────────────────────
  const disconnectWallet = useCallback(() => {
    walletDiag("disconnect requested")
    setWalletAddress(null)
    setChainId(null)
    setWalletSetup("prompt")
    setManualOpen(false)
    setManualValue("")
    setWalletError(null)
    clearWalletSession(apiKey)
    // Also tell the wallet, otherwise it still considers the site connected and
    // the next connect silently returns the same account with no prompt, which
    // reads as "disconnect did nothing".
    try {
      for (const w of discoverStandardWallets()) {
        const d = (w.features as Record<string, { disconnect?: () => Promise<unknown> }> | undefined)?.["aptos:disconnect"]
        if (typeof d?.disconnect === "function") { void Promise.resolve(d.disconnect()).catch(() => {}) }
      }
      const legacy = (window as unknown as { aptos?: { disconnect?: () => Promise<unknown> } }).aptos
      if (typeof legacy?.disconnect === "function") void Promise.resolve(legacy.disconnect()).catch(() => {})
      // Embedded, the connection was made by the host page on our behalf, so
      // the wallet is authorised against the HOST origin. Only the host can
      // undo that.
      if (isEmbedded) window.parent.postMessage({ type: "txid-wallet-disconnect" }, "*")
    } catch { /* best effort: local state is already cleared */ }
  }, [apiKey, discoverStandardWallets, isEmbedded])

  // ── Switch network (one-tap, EIP-3326) ────────────────────────────────────
  const [switching, setSwitching] = useState(false)
  const switchChain = useCallback(async (targetChainId: string, chainName: string) => {
    if (typeof window === "undefined" || !("ethereum" in window)) return
    const eth = (window as unknown as { ethereum: { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum
    setSwitching(true)
    try {
      await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: targetChainId }] })
      setChainId(targetChainId)
      if (walletAddress) saveWalletSession(apiKey, { setup: "connected", address: walletAddress, chainId: targetChainId })
      setMessages((prev) => [...prev, { id: nanoid(), role: "assistant", content: `✅ Switched to ${chainName}. Try your transaction again now.`, local: true }])
    } catch (err) {
      const code = (err as { code?: number })?.code
      if (code === 4001) return // user rejected - say nothing
      const msg = code === 4902
        ? `Your wallet doesn't have ${chainName} added yet - add ${chainName} in your wallet, then try again.`
        : `Couldn't switch automatically. Please change your wallet's network to ${chainName} manually.`
      setMessages((prev) => [...prev, { id: nanoid(), role: "assistant", content: msg, local: true }])
    } finally {
      setSwitching(false)
    }
  }, [apiKey, walletAddress])

  // ── Answer feedback (👍/👎) ───────────────────────────────────────────────
  // Optimistic + fire-and-forget. Clicking the active rating again clears it.
  const sendFeedback = useCallback((msgId: string, content: string, rating: number, current: number) => {
    const next = current === rating ? 0 : rating
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, feedback: next } : m)))
    void fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: apiKey, sessionId: sessionId.current, content, rating: next }),
    }).catch(() => { /* non-fatal - feedback is best-effort */ })
  }, [apiKey])


  // Keep the transcript ref in step with state.
  useEffect(() => { messagesRef.current = messages }, [messages])

  /**
   * Record a beta finding without asking the tester for anything.
   *
   * No name, no email, no form. They are leaving a note, not opening a case,
   * and every field between them and that is a note we do not get. Failure is
   * deliberately quiet: telling someone their compliment failed to send is
   * worse than the compliment not sending.
   */
  const recordFinding = useCallback(async (summary: string, kind: "feedback" | "bug") => {
    try {
      await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: apiKey,
          summary,
          reason: kind,
          conversation: messagesRef.current.map(m => ({ role: m.role, content: m.content })),
          ...(hostContext.current.url ? { pageUrl: hostContext.current.url } : {}),
          ...(isPreview ? { preview: true, previewToken } : {}),
        }),
      })
    } catch { /* see above */ }
  }, [apiKey, isPreview, previewToken])

  // ── Submit support ticket ────────────────────────────────────────────────
  const submitTicket = useCallback(async () => {
    if (!escalation || !ticketName.trim() || !ticketEmail.trim()) return
    setTicketSubmitting(true)
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: apiKey,
          name: ticketName.trim(),
          email: ticketEmail.trim(),
          summary: escalation.summary,
          ...(ticketNote.trim() ? { note: ticketNote.trim() } : {}),
          reason: escalation.reason,
          conversation: messages.map(m => ({ role: m.role, content: m.content })),
          ...(hostContext.current.url ? { pageUrl: hostContext.current.url } : {}),
          ...(isPreview ? { preview: true, previewToken } : {}),
        }),
      })
      const data = res.ok ? (await res.json()) as { ref?: string; error?: string } : null
      if (data?.ref) {
        setTicketError(null)
        setTicketRef(data.ref)
        setMessages(prev => [...prev, {
          id: nanoid(),
          role: "assistant" as const,
          content: `Ticket ${data.ref} has been raised - the team will be in touch at ${ticketEmail.trim()}.`,
          streaming: false,
        }])
      } else {
        setTicketError(`Couldn't submit your ticket. Please try again, or email us at team@txid.support.`)
      }
    } catch {
      setTicketError(`Couldn't reach the server. Please try again, or email us at team@txid.support.`)
    } finally {
      setTicketSubmitting(false)
    }
  }, [isPreview, previewToken, escalation, ticketName, ticketEmail, ticketNote, apiKey, messages])


  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (textArg?: string) => {
    const msgText = (textArg ?? input).trim()
    if (!msgText || isStreaming || !config) return

    // Pressing Feedback sends a fixed opener. The message AFTER it is the
    // feedback itself, so capture it here rather than hoping for a tool call.
    if (msgText === FEEDBACK_OPENER || msgText === BUG_OPENER) {
      awaitingFinding.current = msgText === BUG_OPENER ? "bug" : "feedback"
      findingRecorded.current = false
    } else if (awaitingFinding.current && !findingRecorded.current) {
      const kind = awaitingFinding.current
      awaitingFinding.current = null
      findingRecorded.current = true
      void recordFinding(msgText, kind)
    }

    const userMsg: Message = { id: nanoid(), role: "user", content: msgText }
    const assistantId = nanoid()
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true }

    const history = [...messages, userMsg]
    setMessages([...history, assistantMsg])
    if (!textArg) setInput("")
    setSuggestions([])
    setIsStreaming(true)

    // First engagement docks the beta spotlight: the embed no-ops this when
    // no spotlight is up, so it is safe to send on every message.
    markOriented()
    if (typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage("txid-engaged", "*")
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: apiKey,
          sessionId: sessionId.current,
          messages: history.map((m) => ({ role: m.role, content: m.content })),
          walletAddress: walletAddress ?? undefined,
          chainId: chainId ?? undefined,
          preview: isPreview || undefined,
          previewToken: isPreview ? previewToken : undefined,
          walletMode: walletAddress ? (walletSetup === "connected" ? "connected" : "manual") : undefined,
          pageContext: hostContext.current.url ? hostContext.current : undefined,
          ...(visitorId.current ? { visitorId: visitorId.current } : {}),
        }),
      })

      if (!res.ok) {
        // The route returns JSON (not SSE) for quota/rate-limit/domain/auth
        // errors. Surface the real message ("Monthly conversation limit
        // reached…", "Too many requests…") instead of a generic failure.
        let msg = "Sorry, something went wrong. Please try again."
        try {
          const body = (await res.json()) as { error?: string }
          if (body?.error) msg = body.error
        } catch { /* non-JSON body - keep the generic message */ }
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: msg, streaming: false } : m)),
        )
        setIsStreaming(false)
        return
      }
      if (!res.body) throw new Error("Stream failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const raw = decoder.decode(value)
        for (const line of raw.split("\n")) {
          if (!line.startsWith("data:")) continue
          const payload = line.slice(5).trim()
          if (payload === "[DONE]") break
          try {
            const parsed = JSON.parse(payload) as {
              text?: string
              tool_call?: string
              error?: string
              escalate?: { summary: string; reason: string }
              suggestions?: { items: string[] }
              switch_chain?: { chainId: string; chainName: string }
              wallet_action?: WalletActionPayload
            }
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: `Error: ${parsed.error}`, streaming: false }
                    : m,
                ),
              )
              break
            }
            if (parsed.escalate) {
              const esc = parsed.escalate
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
              )
              // FEEDBACK RECORDS ITSELF. Everything else opens the ticket form.
              //
              // A tester who says "I like it a lot" was being shown a form
              // headed "Raise a support ticket" asking for their name and
              // email, and if they closed it, as anyone reasonably would,
              // their feedback was never recorded at all. The finding only
              // existed once a support ticket had been completed, which is the
              // wrong instrument: they are not waiting for a reply, and the
              // point of the button is that leaving a note costs nothing.
              if (esc.reason === "feedback" || esc.reason === "bug") {
                // Fallback only. The button path above has almost always
                // recorded it already; this covers a report that arrives
                // without the opener, and never double-records.
                if (!findingRecorded.current) {
                  findingRecorded.current = true
                  void recordFinding(esc.summary, esc.reason as "feedback" | "bug")
                }
                // Belt and braces: if the model went straight to the tool with
                // no acknowledgement, say something rather than leaving the
                // tester looking at an empty bubble.
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantId && !m.content.trim()
                      ? { ...m, content: esc.reason === "bug"
                            ? "Thanks, that's logged for the team with everything I could see."
                            : "Thanks, that's recorded for the team." }
                      : m,
                  ),
                )
              } else {
                setEscalation(esc)
              }
              setIsStreaming(false)
              return
            }
            if (parsed.tool_call) {
              // Claude is fetching blockchain data - show tool indicator
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, toolCall: parsed.tool_call } : m,
                ),
              )
            }
            // Curated chips win: ignore the model's follow-ups entirely.
            if (!hasCurated && parsed.suggestions?.items?.length) {
              setSuggestions(parsed.suggestions.items)
            }
            if (parsed.wallet_action) {
              const wa = parsed.wallet_action
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, walletAction: wa } : m)),
              )
            }
            if (parsed.switch_chain) {
              // Wallet is on the wrong network - attach a one-tap switch button
              // to this message (only actionable for injected/connected wallets).
              const sc = parsed.switch_chain
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, switchAction: sc } : m)),
              )
            }
            if (parsed.text) {
              // Text is streaming - clear any tool indicator
              accumulated += parsed.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated, toolCall: null } : m,
                ),
              )
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }

      // A stream that ends with no text at all would leave an empty bubble and
      // no way forward, so give the user something to act on.
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                streaming: false,
                toolCall: null,
                content: m.content || "I didn't get an answer back that time. Please try asking again, or use Speak to a person below.",
              }
            : m,
        ),
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again.", streaming: false, toolCall: null }
            : m,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, config, messages, apiKey, walletAddress, chainId, isPreview, previewToken, walletSetup, hasCurated])

  const sendActionResult = useCallback(async (actionId: string, txHash: string, status: "confirmed" | "failed", gasUsed?: string, blockNumber?: string) => {
    if (!config) return
    const assistantId = nanoid()
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "", streaming: true }])
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: apiKey,
          sessionId: sessionId.current,
          messages: messages.filter((m) => !m.local).map((m) => ({ role: m.role, content: m.content })),
          walletAddress: walletAddress ?? undefined,
          chainId: chainId ?? undefined,
          walletMode: "connected",
          actionResult: { actionId, txHash, status, ...(gasUsed ? { gasUsed } : {}), ...(blockNumber ? { blockNumber } : {}) },
        }),
      })
      if (!res.ok || !res.body) throw new Error("follow-up failed")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of decoder.decode(value).split("\n")) {
          if (!line.startsWith("data:")) continue
          const payload = line.slice(5).trim()
          if (payload === "[DONE]") break
          try {
            const parsed = JSON.parse(payload) as { text?: string; tool_call?: string }
            if (parsed.tool_call) setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, toolCall: parsed.tool_call } : m)))
            if (parsed.text) {
              accumulated += parsed.text
              setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated, toolCall: null } : m)))
            }
          } catch { /* partial chunk */ }
        }
      }
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)))
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: status === "confirmed" ? "Transaction confirmed on-chain." : "The transaction failed - paste the hash and I can diagnose it.", streaming: false, local: true }
            : m,
        ),
      )
    }
  }, [config, apiKey, messages, walletAddress, chainId])

  // ── External prompt listener (for preview page clickable prompts) ─────────
  const sendMessageRef = useRef(sendMessage)
  useEffect(() => { sendMessageRef.current = sendMessage })
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail
      if (text) sendMessageRef.current(text)
    }
    window.addEventListener("txid-prompt", handler)
    return () => window.removeEventListener("txid-prompt", handler)
  }, [])

  // Re-focus the chat input whenever the bot finishes streaming
  useEffect(() => {
    if (!isStreaming) inputRef.current?.focus()
  }, [isStreaming])

  // ── Error state ──────────────────────────────────────────────────────────
  if (configError) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950 p-4">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircleIcon className="size-4 shrink-0" />
          {configError}
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex h-full items-center justify-center bg-zinc-950">
        <Loader2Icon className="size-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  const b = config.branding
  const isTokenMode = config.mode === "token"
  // Move-chain wording (module, .apt) for Aptos-only projects.
  const aptosWording = isAptosProject && !hasEvmChain
  const hasWallet =
    walletTarget === "solana"
      ? hasPhantom || (isEmbedded && !!bridgeWallet?.solana)
      : walletTarget === "aptos"
        ? aptosProviderAvailable || evmProviderAvailable
        : evmProviderAvailable
  // Name the wallet we will actually open, derived from the same target.
  const connectLabel =
    walletTarget === "solana"
      ? "Connect Phantom"
      : walletTarget === "aptos"
        ? (hasMartian && !hasPetraLike ? "Connect Martian" : "Connect Petra")
        : "Connect wallet"

  // Ensure text always contrasts with the background regardless of branding config
  const bgIsLight = getBgLuminance(b.backgroundColor) > 0.5
  const adaptiveText = bgIsLight ? "#111111" : b.textColor
  // Text drawn ON a coloured surface (header, bubbles, buttons) must contrast
  // with THAT surface, not the widget background. Without this a light brand
  // colour (e.g. Decibel's yellow) gets white text and is unreadable.
  const onPrimary = getBgLuminance(b.primaryColor) > 0.5 ? "#111111" : "#ffffff"
  const onSecondary = getBgLuminance(b.secondaryColor) > 0.5 ? "#111111" : "#ffffff"
  // Desktop only - on mobile the widget is a full-width sheet, so zooming would
  // clip horizontally. (Panel renders after async config load, so window is safe.)
  const isNarrow = typeof window !== "undefined" && window.innerWidth <= 440
  const widgetScale = isNarrow ? 1 : (FONT_SCALE_VALUE[b.fontScale ?? "md"] ?? 1)

  const hasInfoContent = !!(config?.token || (config?.contentBlocks ?? []).length > 0)

  const TABS = isTokenMode
    ? [
        { id: "trade",     label: "Trade" },
        { id: "community", label: "Community" },
        { id: "ask",       label: "Ask" },
      ]
    : [
        { id: "chat", label: "Chat", icon: MessageCircleIcon },
        ...(hasInfoContent ? [{ id: "info", label: "Info", icon: InfoIcon }] : []),
      ]

  // CSS variables for branding - applied to the root container
  const cssVars = {
    "--w-primary": b.primaryColor,
    "--w-secondary": b.secondaryColor,
    "--w-bg": b.backgroundColor,
    "--w-text": adaptiveText,
    "--w-border": bgIsLight ? "rgba(0,0,0,0.1)" : `${b.primaryColor}33`,
    "--txid-text": adaptiveText,
    "--txid-muted": `${adaptiveText}99`,
    fontFamily: `'${b.font}', sans-serif`,
    backgroundColor: b.backgroundColor,
    color: adaptiveText,
    // Uniform zoom scales all text + spacing together. md (1.0) is a no-op.
    ...(widgetScale !== 1 ? { zoom: widgetScale } : {}),
  } as React.CSSProperties

  return (
    <div
      className="txid-widget-root flex h-full flex-col overflow-hidden"
      style={{
        ...cssVars,
        // Hairline edge. On a dark host page the panel background is often close
        // to the site's own, leaving the widget with no readable boundary. An
        // explicit border wins; otherwise a low-opacity tint of the brand colour
        // defines the edge without introducing a second colour.
        border: `1px solid ${b.borderColor?.trim() || `${b.primaryColor}33`}`,
        borderRadius: "16px",
      }}
    >
      {/* Placeholders otherwise keep the browser's own grey, which disappears on
          a dark widget, and every control here sets outline-none, so keyboard
          focus was invisible. currentColor keeps both readable on any brand. */}
      <style>{
        ".txid-widget-root input::placeholder{color:currentColor;opacity:.45}" +
        ".txid-widget-root button:focus-visible,.txid-widget-root a:focus-visible{outline:2px solid currentColor;outline-offset:2px}"
      }</style>
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-2 px-4 py-3"
        style={{ backgroundColor: b.primaryColor }}
      >
        {b.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={b.logoUrl} alt="Logo" className="size-6 rounded-full object-cover" />
        ) : (
          <div
            className="flex size-7 items-center justify-center rounded-full text-sm font-bold"
            style={{ backgroundColor: b.secondaryColor, color: onSecondary }}
          >
            {config.projectName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: onPrimary }}>
          {b.agentName?.trim() || config.projectName}
          {/* The pill reframes every rough edge a tester meets: this is a
              beta and they are part of testing it. Server-resolved, so it
              disappears the moment the programme ends. */}
          {config.beta && (
            <span
              className="ml-1.5 inline-block rounded-full px-1.5 py-px align-middle text-[9px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: `${onPrimary}22`, color: onPrimary }}
            >
              Beta tester
            </span>
          )}
        </span>
        {!isTokenMode && !b.hideWallet && (
          walletAddress ? (
            <button
              onClick={disconnectWallet}
              title="Disconnect wallet"
              className="group flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono transition-opacity hover:opacity-90 active:opacity-70"
              style={{ backgroundColor: b.secondaryColor, color: onSecondary }}
            >
              {shortAddr(walletAddress)}
              <LogOutIcon className="size-3 opacity-70 group-hover:opacity-100" />
            </button>
          ) : manualOpen ? (
            // Checked BEFORE hasWallet: a failed or rejected wallet connect
            // opens this field, and it has to be visible even when a provider
            // was detected, otherwise that failure is a dead end.
            <div className="flex shrink-0 items-center gap-1" title={walletError ?? undefined}>
              <input
                autoFocus
                value={manualFocused ? manualValue : (shortenHex(manualValue.trim()) ?? manualValue)}
                onFocus={() => setManualFocused(true)}
                onBlur={() => setManualFocused(false)}
                onChange={(e) => { setManualValue(e.target.value); setManualError(false) }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitManualAddress()
                  if (e.key === "Escape") { setManualOpen(false); setManualError(false) }
                }}
                placeholder="Paste your address…"
                aria-label="Wallet address"
                aria-invalid={manualError}
                title={manualError ? "That does not look like a valid address" : "Paste a wallet address, or press Escape to go back"}
                className="w-36 rounded-full px-2.5 py-1 text-xs font-mono outline-none"
                // This field sits ON the header, so it contrasts with the brand
                // colour, not with the widget background. On a light brand
                // (Decibel's yellow) the old widget-background colours put white
                // text on yellow.
                style={{
                  backgroundColor: onPrimary === "#111111" ? "rgba(0,0,0,0.07)" : "rgba(255,255,255,0.10)",
                  color: onPrimary,
                  border: manualError
                    ? `1px solid ${onPrimary === "#111111" ? "#b91c1c" : "#f87171"}`
                    : `1px solid ${onPrimary}33`,
                }}
              />
              <button
                onClick={submitManualAddress}
                className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity active:opacity-70"
                style={{ backgroundColor: b.secondaryColor, color: onSecondary }}
              >
                Go
              </button>
            </div>
          ) : hasWallet ? (
            <button
              onClick={connectWallet}
              disabled={walletConnecting}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity disabled:opacity-40 active:opacity-70"
              style={{ backgroundColor: b.secondaryColor, color: onSecondary }}
            >
              {walletConnecting ? "Connecting…" : connectLabel}
            </button>
          ) : (
            <button
              onClick={() => setManualOpen(true)}
              className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-opacity active:opacity-70"
              style={{ backgroundColor: b.secondaryColor, color: onSecondary }}
            >
              Enter address
            </button>
          )
        )}
        <button
          type="button"
          aria-label="Close"
          onClick={() => {
            if (onClose) {
              onClose()
            } else if (typeof window !== "undefined" && window.parent !== window) {
              window.parent.postMessage("txid-close", "*")
              // Also reach the top window in case the widget is nested one frame deeper.
              if (window.top && window.top !== window.parent) {
                window.top.postMessage("txid-close", "*")
              }
            } else {
              window.history.back()
            }
          }}
          className="ml-1 shrink-0 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
          style={{ color: onPrimary }}
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {config.statusNotice?.message && (
        <div
          className="shrink-0 border-b px-4 py-2.5"
          style={{ borderColor: "var(--w-border)", backgroundColor: "#f59e0b1a" }}
          role="status"
        >
          <p className="text-[11px] font-semibold" style={{ color: adaptiveText }}>
            {config.projectName} service update
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed" style={{ color: adaptiveText, opacity: 0.85 }}>
            {config.statusNotice.message}
          </p>
        </div>
      )}

      {walletAddress && (
        <IdentityBar
          wallet={walletAddress}
          account={protocolAccount}
          adaptiveText={adaptiveText}
          accent={b.primaryColor}
          border="var(--w-border)"
        />
      )}

      {/* Tab bar. A lone "Chat" tab is dead chrome, so it only renders when
          there is somewhere else to go. */}
      {TABS.length > 1 && (
      <div
        className="flex shrink-0 border-b text-xs"
        style={{ borderColor: `var(--w-border)` }}
      >
        {TABS.map((t) => {
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex flex-1 items-center justify-center gap-1.5 py-2.5 capitalize transition-opacity"
              style={{
                opacity: tab === t.id ? 1 : 0.45,
                borderBottom: tab === t.id ? `2px solid ${b.primaryColor}` : "2px solid transparent",
                color: adaptiveText,
              }}
            >
              {"icon" in t && t.icon && <t.icon className="size-3.5" />}
              {t.label}
            </button>
          )
        })}
      </div>
      )}

      {/* Tab content */}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">

        {/* ── Token Mode tabs ────────────────────────────────────────────── */}

        {isTokenMode && tab === "trade" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "16px", height: "100%", overflowY: "auto" }}>
            {dexLoading && !dexData ? (
              <div style={{ textAlign: "center", color: "var(--txid-muted)", fontSize: "13px", padding: "32px 0" }}>
                Loading price data…
              </div>
            ) : dexData ? (
              <>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    {(() => {
                      const price = dexData.priceUsd ? parseFloat(dexData.priceUsd) : null
                      const change24h = dexData.priceChange?.h24 ?? null
                      const isUp = (change24h ?? 0) >= 0
                      return (
                        <>
                          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--txid-text)" }}>
                            {price != null ? `$${price < 0.01 ? price.toExponential(4) : price.toFixed(4)}` : "-"}
                          </div>
                          {change24h != null && (
                            <div style={{ fontSize: "13px", color: isUp ? "#22c55e" : "#ef4444", marginTop: "2px" }}>
                              {isUp ? "▲" : "▼"} {Math.abs(change24h).toFixed(2)}% (24h)
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                  <PriceSparkline priceChange={dexData.priceChange} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  {[
                    { label: "Market Cap", value: formatUsd(dexData.marketCap) },
                    { label: "Volume 24h", value: formatUsd(dexData.volume?.h24) },
                    { label: "Liquidity",  value: formatUsd(dexData.liquidity?.usd) },
                    { label: "FDV",        value: formatUsd(dexData.fdv) },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: "rgba(255,255,255,0.04)", borderRadius: "8px", padding: "10px" }}>
                      <div style={{ fontSize: "10px", color: "var(--txid-muted)", marginBottom: "2px" }}>{label}</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--txid-text)" }}>{value}</div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", color: "var(--txid-muted)", fontSize: "13px", padding: "32px 0" }}>
                Price data unavailable - check DexScreener
              </div>
            )}

            {config.token?.dexUrl && (
              <a
                href={config.token.dexUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "block",
                  background: b.primaryColor,
                  color: "#fff",
                  borderRadius: "10px",
                  padding: "12px",
                  textAlign: "center",
                  fontWeight: 600,
                  fontSize: "14px",
                  textDecoration: "none",
                }}
              >
                Buy {config.token.symbol ?? "TOKEN"} →
              </a>
            )}
          </div>
        )}

        {isTokenMode && tab === "community" && (
          <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", height: "100%", overflowY: "auto" }}>
            {config.community ? (
              <>
                {(() => {
                  const links = [
                    { key: "discord",    label: "Discord",    icon: "💬", url: config.community!.discord },
                    { key: "twitter",    label: "Twitter/X",  icon: "𝕏",  url: config.community!.twitter },
                    { key: "telegram",   label: "Telegram",   icon: "✈️",  url: config.community!.telegram },
                    { key: "website",    label: "Website",    icon: "🌐", url: config.community!.website },
                    { key: "whitepaper", label: "Whitepaper", icon: "📄", url: config.community!.whitepaper },
                  ].filter((l) => l.url)
                  return links.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {links.map(({ key, label, icon, url }) => (
                        <a
                          key={key}
                          href={url!}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            background: "rgba(255,255,255,0.06)",
                            border: "1px solid rgba(255,255,255,0.1)",
                            borderRadius: "8px",
                            padding: "8px 12px",
                            fontSize: "13px",
                            color: "var(--txid-text)",
                            textDecoration: "none",
                          }}
                        >
                          <span>{icon}</span> {label}
                        </a>
                      ))}
                    </div>
                  ) : null
                })()}
                {config.community.announcement && (
                  <div style={{
                    background: "rgba(99,102,241,0.1)",
                    border: "1px solid rgba(99,102,241,0.3)",
                    borderRadius: "10px",
                    padding: "12px",
                    fontSize: "13px",
                    color: "var(--txid-text)",
                    lineHeight: 1.5,
                  }}>
                    📢 {config.community.announcement}
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--txid-muted)", fontSize: "13px" }}>
                No community links configured.
              </div>
            )}
          </div>
        )}

        {isTokenMode && tab === "ask" && (
          <div className="flex h-full flex-col">
            <div ref={messagesContainerRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto p-3">
              {messages.length === 0 && (
                <div
                  key="init-ask"
                  className="flex items-start gap-2"
                >
                  {(b.agentIconUrl || b.logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.agentIconUrl ?? b.logoUrl!} alt={b.agentName || "AI"} className="size-6 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: b.primaryColor, color: onPrimary }}
                    >
                      {b.agentName ? b.agentName.slice(0, 2).toUpperCase() : "AI"}
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor: b.secondaryColor,
                      color: onSecondary,
                      borderRadius: "1rem 1rem 1rem 0.25rem",
                    }}
                  >
                    Hi! Ask me anything about {config.projectName}.
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : ""}`}
                >
                  {m.role === "assistant" && (
                    (b.agentIconUrl || b.logoUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.agentIconUrl ?? b.logoUrl!} alt={b.agentName || "AI"} className="size-6 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: b.primaryColor, color: onPrimary }}
                      >
                        {b.agentName ? b.agentName.slice(0, 2).toUpperCase() : "AI"}
                      </div>
                    )
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-3 py-2 text-xs break-words"
                    style={{
                      backgroundColor: m.role === "user" ? b.primaryColor : b.secondaryColor,
                      color: m.role === "user" ? onPrimary : onSecondary,
                      borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {m.content ? (
                      m.role === "assistant" ? (
                        <MessageContent text={m.content} primaryColor={b.primaryColor} />
                      ) : m.content
                    ) : (m.streaming && (
                      <span className="inline-flex items-center gap-1 opacity-60">
                        <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "0ms" }} />
                        <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "150ms" }} />
                        <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "300ms" }} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            {visibleChips.length > 0 && !isStreaming && (
              <div className="shrink-0 flex flex-wrap gap-1.5 px-3 pt-2.5 pb-2">
                {visibleChips.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-[11px] rounded-full px-3 py-1.5 border transition-opacity hover:opacity-100 active:scale-95"
                    style={{
                      borderColor: `${b.primaryColor}55`,
                      color: adaptiveText,
                      background: `${b.primaryColor}14`,
                      opacity: 0.9,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div
              className="shrink-0 flex items-center gap-2 border-t px-3 py-2"
              style={{ borderColor: `var(--w-border)` }}
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => { setInput(e.target.value); if (suggestions.length) setSuggestions([]) }}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask anything…"
                disabled={isStreaming}
                className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
                style={{ color: b.inputTextColor ?? adaptiveText }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isStreaming || !input.trim()}
                aria-label="Send"
                className="flex size-8 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
                style={{ backgroundColor: b.primaryColor }}
              >
                {isStreaming ? (
                  <Loader2Icon className="size-3.5 animate-spin" style={{ color: onPrimary }} />
                ) : (
                  <SendIcon className="size-3.5" style={{ color: onPrimary }} />
                )}
              </button>
            </div>
            {config.disclaimer && (
              <p
                className="px-1 pt-1.5 text-center text-[9px] leading-snug"
                style={{ color: adaptiveText, opacity: 0.4 }}
              >
                {config.disclaimer}
              </p>
            )}
          </div>
        )}

        {/* ── Support Mode tabs ─────────────────────────────────────────── */}

        {!isTokenMode && tab === "chat" && (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div ref={messagesContainerRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto p-3">
              {(() => {
                return messages.map((m) => (
                <div key={m.id}>
                  <div className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                    {m.role === "assistant" && (
                      (b.agentIconUrl || b.logoUrl) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.agentIconUrl ?? b.logoUrl!} alt={b.agentName || "AI"} className="size-6 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div
                          className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: b.primaryColor, color: onPrimary }}
                        >
                          {b.agentName ? b.agentName.slice(0, 2).toUpperCase() : "AI"}
                        </div>
                      )
                    )}
                    <div
                      className="max-w-[80%] rounded-2xl px-3 py-2 text-xs break-words"
                      style={{
                        backgroundColor: m.role === "user" ? b.primaryColor : b.secondaryColor,
                        color: m.role === "user" ? onPrimary : onSecondary,
                        borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {m.content ? (
                        m.role === "assistant" ? (
                          <MessageContent text={m.content} primaryColor={b.primaryColor} />
                        ) : m.content
                      ) : (m.streaming && (
                        m.toolCall ? (
                          <span className="inline-flex items-center gap-1.5 opacity-70">
                            <Loader2Icon className="size-2.5 animate-spin" />
                            <span className="text-[11px]">
                              {toolLabel(m.toolCall, aptosWording)}
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 opacity-60">
                            <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "0ms" }} />
                            <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "150ms" }} />
                            <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "300ms" }} />
                          </span>
                        )
                      ))}
                      {/* Claude often calls another chain tool part-way through an
                          answer. Without this the panel looks frozen mid-sentence. */}
                      {m.streaming && !!m.content && m.toolCall && (
                        <span className="mt-1.5 flex items-center gap-1.5 opacity-70">
                          <Loader2Icon className="size-2.5 shrink-0 animate-spin" />
                          <span className="text-[11px]">{toolLabel(m.toolCall, aptosWording)}</span>
                        </span>
                      )}
                      {m.switchAction &&
                        walletSetup === "connected" &&
                        chainId !== "solana" &&
                        chainId !== "aptos" &&
                        chainId !== m.switchAction.chainId &&
                        typeof window !== "undefined" &&
                        "ethereum" in window && (
                          <button
                            onClick={() => switchChain(m.switchAction!.chainId, m.switchAction!.chainName)}
                            disabled={switching}
                            className="mt-2 w-full rounded-lg py-1.5 text-[11px] font-semibold transition-opacity disabled:opacity-50"
                            style={{ backgroundColor: b.primaryColor, color: onPrimary }}
                          >
                            {switching ? "Switching…" : `Switch to ${m.switchAction.chainName} →`}
                          </button>
                        )}
                      {m.walletAction &&
                        config?.actions?.enabled &&
                        walletSetup === "connected" &&
                        walletAddress &&
                        chainId !== "solana" &&
                        chainId !== "aptos" &&
                        typeof window !== "undefined" &&
                        "ethereum" in window && (
                          <ActionCard
                            action={m.walletAction}
                            apiKey={apiKey}
                            sessionId={sessionId.current}
                            expectedAddress={walletAddress}
                            chainId={chainId}
                            primaryColor={b.primaryColor}
                            textColor={b.textColor}
                            onResult={(id, hash, st, gasUsed, blockNumber) => void sendActionResult(id, hash, st, gasUsed, blockNumber)}
                          />
                        )}
                      {m.role === "assistant" && !m.local && !!m.content && !m.streaming && (
                        <div className="mt-1.5 flex items-center gap-2.5">
                          <button
                            aria-label="Helpful"
                            onClick={() => sendFeedback(m.id, m.content, 1, m.feedback ?? 0)}
                            className="transition-opacity hover:opacity-100"
                            style={{ opacity: m.feedback === 1 ? 1 : 0.4 }}
                          >
                            <ThumbsUpIcon className="size-3" style={{ fill: m.feedback === 1 ? "currentColor" : "none" }} />
                          </button>
                          <button
                            aria-label="Not helpful"
                            onClick={() => sendFeedback(m.id, m.content, -1, m.feedback ?? 0)}
                            className="transition-opacity hover:opacity-100"
                            style={{ opacity: m.feedback === -1 ? 1 : 0.4 }}
                          >
                            <ThumbsDownIcon className="size-3" style={{ fill: m.feedback === -1 ? "currentColor" : "none" }} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
              })()}

              {/* Beta orientation card. IN the conversation flow, directly
                  under the intro, because it is the thing the tester should
                  read and act on: the first version sat in the footer slot,
                  tiny and orphaned from the intro it belonged to, with the
                  panel's whole middle left empty. It says what customer copy
                  cannot be trusted to say (the assistant lives in the corner;
                  the pencil is feedback) and ends the introduction with
                  "Let's go", which docks and closes via the embed so the
                  tester watches it settle where it lives. Gone forever after
                  their first message. */}
              {config?.beta && !escalation && !oriented && !messages.some(m => m.role === "user") && (
                <div
                  className="mx-auto mt-5 w-[92%] rounded-xl border p-4 text-center"
                  style={{ background: `${b.primaryColor}14`, borderColor: `${b.primaryColor}33` }}
                >
                  <p className="text-xs leading-relaxed" style={{ color: adaptiveText, opacity: 0.9 }}>
                    I&apos;ll be right here in the corner whenever you need me.
                    {config?.beta?.feedback
                      ? " Spot something off? The Feedback button next to the message box sends it straight to the team."
                      : null}
                  </p>
                  <button
                    onClick={() => {
                      markOriented()
                      if (window.parent !== window) window.parent.postMessage("txid-letsgo", "*")
                    }}
                    className="mt-3.5 w-full rounded-lg px-4 py-2 text-sm font-bold transition-opacity hover:opacity-90 active:scale-[0.98]"
                    style={{ backgroundColor: b.primaryColor, color: onPrimary }}
                  >
                    Let&apos;s go →
                  </button>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Ticket escalation form - shown when AI triggers escalation */}
            {escalation && (
              <div
                className="shrink-0 border-t space-y-2.5 px-3 py-3"
                style={{ borderColor: `var(--w-border)` }}
              >
                {!ticketRef ? (
                  <>
                    <div>
                      <p className="text-xs font-semibold mb-0.5">Raise a support ticket</p>
                      {/* Summaries often quote a 66 char hash: it must wrap. */}
                      <p className="text-[11px] opacity-50 leading-relaxed" style={{ overflowWrap: "anywhere" }}>{escalation.summary}</p>
                    </div>
                    <input
                      type="text"
                      value={ticketName}
                      onChange={e => setTicketName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-transparent text-xs outline-none border-b pb-1.5 placeholder:opacity-30"
                      style={{ color: b.inputTextColor ?? adaptiveText, borderColor: `var(--w-border)` }}
                    />
                    <input
                      type="email"
                      value={ticketEmail}
                      onChange={e => setTicketEmail(e.target.value)}
                      placeholder="Your email"
                      className="w-full bg-transparent text-xs outline-none border-b pb-1.5 placeholder:opacity-30"
                      style={{ color: b.inputTextColor ?? adaptiveText, borderColor: `var(--w-border)` }}
                    />
                    <textarea
                      value={ticketNote}
                      onChange={e => setTicketNote(e.target.value)}
                      rows={2}
                      placeholder="Anything else that would help the team? (optional)"
                      className="w-full resize-none bg-transparent text-xs outline-none border-b pb-1.5 placeholder:opacity-30"
                      style={{ color: b.inputTextColor ?? adaptiveText, borderColor: `var(--w-border)` }}
                    />
                    {ticketError && (
                      <p className="text-[11px] text-red-400 leading-snug">{ticketError}</p>
                    )}
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={submitTicket}
                        disabled={ticketSubmitting || !ticketName.trim() || !ticketEmail.trim()}
                        className="flex-1 rounded-xl py-2 text-xs font-semibold transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: b.primaryColor, color: onPrimary }}
                      >
                        {ticketSubmitting ? "Submitting…" : "Submit ticket"}
                      </button>
                      <button
                        onClick={() => { setEscalation(null); setTicketName(""); setTicketEmail("") }}
                        className="text-[11px] opacity-30 hover:opacity-60 transition-opacity"
                        style={{ color: adaptiveText }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold opacity-70">Ticket {ticketRef} created</p>
                    <p className="text-[11px] opacity-50" style={{ overflowWrap: "anywhere" }}>We&apos;ll be in touch at {ticketEmail}.</p>
                    <button
                      onClick={() => { setEscalation(null); setTicketRef(null) }}
                      className="text-[11px] opacity-40 hover:opacity-70 transition-opacity"
                      style={{ color: adaptiveText }}
                    >
                      Continue chatting →
                    </button>
                  </>
                )}
              </div>
            )}


            {/* Quick-reply chips - appear after each AI response, cleared on send */}
            {visibleChips.length > 0 && !isStreaming && !escalation && (
              <div className="shrink-0 flex flex-wrap gap-1.5 px-3 pt-2.5 pb-2">
                {visibleChips.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-[11px] rounded-full px-3 py-1.5 border transition-opacity hover:opacity-100 active:scale-95"
                    style={{
                      borderColor: `${b.primaryColor}55`,
                      color: adaptiveText,
                      background: `${b.primaryColor}14`,
                      opacity: 0.9,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Speak to a person - always available once conversation has started */}
            {!escalation && messages.length > 1 && !isStreaming && (
              <div className="shrink-0 flex justify-center pb-1">
                <button
                  onClick={() => setEscalation({ summary: "User requested to speak with a person.", reason: "user_requested" })}
                  className="text-[10px] transition-opacity hover:opacity-70"
                  style={{ color: adaptiveText, opacity: 0.45 }}
                >
                  Speak to a person →
                </button>
              </div>
            )}

            {/* Input - hidden while escalation form is shown */}
            {!escalation && (
              <>
              {/* THE BUTTONS SIT ABOVE THE INPUT, not inside it. Two pills in
                  the composer row squeezed "Ask anything" into a sliver, so
                  the primary action, typing, read as the smallest thing there.
                  A row of its own keeps both discoverable without either
                  crowding the other. */}
              {config?.beta?.feedback && (
                <div
                  className="shrink-0 flex items-center gap-2 border-t px-3 pt-2"
                  style={{ borderColor: `var(--w-border)` }}
                >
                {/* LABELLED, not icon-only. The bare pencil failed twice:
                    the owner did not recognise it and predicted testers would
                    not either. In a beta, feedback is a primary action, and
                    primary actions get words. */}
                <button
                    onClick={() => sendMessage(FEEDBACK_OPENER)}
                    disabled={isStreaming}
                    aria-label="Leave feedback"
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: `${b.primaryColor}26`, borderColor: `${b.primaryColor}55`, color: adaptiveText }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                    Feedback
                  </button>
                {/* BUGS ARE NOT FEEDBACK, and one button for both gets one of
                    them. A tester with something broken wants it fixed; a
                    tester with an opinion wants to be heard. Splitting the
                    button is what lets the team read the two queues
                    differently, which is the whole point. */}
                <button
                    onClick={() => sendMessage(BUG_OPENER)}
                    disabled={isStreaming}
                    aria-label="Report a bug"
                    className="flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold transition-opacity hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: `${b.primaryColor}26`, borderColor: `${b.primaryColor}55`, color: adaptiveText }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" />
                      <path d="M9 7.13V6a3 3 0 1 1 6 0v1.13" />
                      <path d="M12 20a6 6 0 0 0 6-6v-3a4 4 0 0 0-4-4h-4a4 4 0 0 0-4 4v3a6 6 0 0 0 6 6Z" />
                      <path d="M6 13H2" /><path d="M22 13h-4" />
                    </svg>
                    Bug
                  </button>
                </div>
              )}
              <div
                className={`shrink-0 flex items-center gap-2 px-3 py-2${config?.beta?.feedback ? "" : " border-t"}`}
                style={config?.beta?.feedback ? undefined : { borderColor: `var(--w-border)` }}
              >
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); if (suggestions.length) setSuggestions([]) }}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Ask anything…"
                  disabled={isStreaming}
                  className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
                  style={{ color: b.inputTextColor ?? adaptiveText }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isStreaming || !input.trim()}
                  aria-label="Send"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: b.primaryColor }}
                >
                  {isStreaming ? (
                    <Loader2Icon className="size-3.5 animate-spin" style={{ color: onPrimary }} />
                  ) : (
                    <SendIcon className="size-3.5" style={{ color: onPrimary }} />
                  )}
                </button>
              </div>
              </>
            )}
            {config.disclaimer && (
              <p
                className="px-1 pt-1.5 text-center text-[9px] leading-snug"
                style={{ color: adaptiveText, opacity: 0.4 }}
              >
                {config.disclaimer}
              </p>
            )}
          </div>
        )}

        {/* Info tab */}
        {!isTokenMode && tab === "info" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {config.token && config.token.showInWidget === true && (
              <div
                className="rounded-xl px-4 py-3 relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, ${b.primaryColor}28 0%, ${b.primaryColor}08 100%)`,
                  border: `1px solid ${b.primaryColor}30`,
                }}
              >
                <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: b.primaryColor, opacity: 0.75 }}>Token</p>
                <p className="text-sm font-bold" style={{ color: adaptiveText }}>{config.token.symbol ?? (config.token.address ? `${config.token.address.slice(0, 6)}…${config.token.address.slice(-4)}` : "Token")}</p>
                {config.token.dexUrl && (
                  <a
                    href={config.token.dexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium hover:opacity-80 transition-opacity"
                    style={{ color: b.primaryColor }}
                  >
                    View on DEX <ExternalLinkIcon className="size-3" />
                  </a>
                )}
              </div>
            )}


            {/* Content blocks */}
            {(config.contentBlocks ?? []).length > 0 && (
              <div className="space-y-3">
                {(config.contentBlocks ?? []).map((block) => {
                  const c = (block.content && typeof block.content === "object")
                    ? block.content as Record<string, string>
                    : {}

                  if (block.type === "video") {
                    const embedUrl = c.url ? getVideoEmbedUrl(c.url) : null
                    if (!embedUrl) return null
                    return (
                      <div key={block.id}>
                        {block.title && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-0.5 h-3 rounded-full shrink-0" style={{ backgroundColor: b.primaryColor }} />
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: adaptiveText, opacity: 0.5 }}>{block.title}</p>
                          </div>
                        )}
                        <div className="relative w-full rounded-xl overflow-hidden" style={{ paddingBottom: "56.25%" }}>
                          <iframe
                            src={embedUrl}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      </div>
                    )
                  }

                  if (block.type === "text" && c.body) {
                    return (
                      <div key={block.id} className="rounded-xl p-3" style={{ backgroundColor: b.secondaryColor, borderLeft: `3px solid ${b.primaryColor}55` }}>
                        {block.title && <p className="text-xs font-semibold mb-1.5" style={{ color: adaptiveText }}>{block.title}</p>}
                        <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: adaptiveText, opacity: 0.75 }}>{c.body}</p>
                      </div>
                    )
                  }

                  if (block.type === "link" && c.url) {
                    return (
                      <a
                        key={block.id}
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl p-3 hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: b.secondaryColor, color: adaptiveText, border: `1px solid ${b.primaryColor}20` }}
                      >
                        <div
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg"
                          style={{ backgroundColor: `${b.primaryColor}18` }}
                        >
                          <ExternalLinkIcon className="size-3.5" style={{ color: b.primaryColor }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{block.title}</p>
                          {c.description && <p className="text-[10px] mt-0.5" style={{ color: adaptiveText, opacity: 0.55 }}>{c.description}</p>}
                        </div>
                        <ExternalLinkIcon className="size-3 opacity-25 shrink-0" />
                      </a>
                    )
                  }

                  if (block.type === "image" && c.url) {
                    return (
                      <div key={block.id}>
                        {block.title && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-0.5 h-3 rounded-full shrink-0" style={{ backgroundColor: b.primaryColor }} />
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: adaptiveText, opacity: 0.5 }}>{block.title}</p>
                          </div>
                        )}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={c.url} alt={c.alt || block.title || ""} className="w-full rounded-xl object-cover" />
                      </div>
                    )
                  }

                  if (block.type === "html" && c.code) {
                    return (
                      <div
                        key={block.id}
                        className="text-[11px]"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(c.code) }}
                      />
                    )
                  }

                  if (block.type === "social") {
                    const links = [
                      c.twitter  && { key: "twitter",  label: "X / Twitter", url: c.twitter },
                      c.discord  && { key: "discord",  label: "Discord",     url: c.discord },
                      c.telegram && { key: "telegram", label: "Telegram",    url: c.telegram },
                      c.github   && { key: "github",   label: "GitHub",      url: c.github },
                      c.website  && { key: "website",  label: "Website",     url: c.website },
                    ].filter(Boolean) as { key: string; label: string; url: string }[]
                    if (links.length === 0) return null
                    return (
                      <div key={block.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: b.backgroundColor, border: `1px solid ${b.primaryColor}22` }}>
                        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${b.primaryColor}, ${b.primaryColor}30)` }} />
                        {block.title && (
                          <p className="text-[10px] font-bold uppercase tracking-widest px-3 pt-2.5 pb-1" style={{ color: adaptiveText, opacity: 0.5 }}>{block.title}</p>
                        )}
                        <div>
                          {links.map((link, li) => (
                            <a
                              key={link.key}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-3 py-2.5 transition-opacity hover:opacity-80 active:opacity-50"
                              style={{
                                color: adaptiveText,
                                borderTop: li > 0 ? `1px solid ${adaptiveText}10` : undefined,
                              }}
                            >
                              <div
                                className="flex size-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                                style={{ backgroundColor: SOCIAL_COLORS[link.key] ?? b.primaryColor }}
                              >
                                <SocialIcon platform={link.key} />
                              </div>
                              <span className="flex-1 text-xs font-semibold">{link.label}</span>
                              <ExternalLinkIcon className="size-3.5 opacity-25 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  if (block.type === "docs") {
                    const pages = [
                      { label: c.label1, url: c.url1 },
                      { label: c.label2, url: c.url2 },
                      { label: c.label3, url: c.url3 },
                      { label: c.label4, url: c.url4 },
                      { label: c.label5, url: c.url5 },
                    ].filter((p) => p.url) as { label?: string; url: string }[]
                    if (pages.length === 0) return null
                    const pageLabel = (p: { label?: string; url: string }) => {
                      if (p.label?.trim()) return p.label // as typed
                      // Derive a readable title from the URL path (last segment).
                      try {
                        const u = new URL(p.url)
                        const seg = u.pathname.replace(/\/$/, "").split("/").filter(Boolean).pop()
                        if (!seg) return u.hostname
                        return seg.replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase())
                      } catch { return p.url }
                    }
                    return (
                      <div key={block.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: b.backgroundColor, border: `1px solid ${b.primaryColor}22` }}>
                        <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${b.primaryColor}, ${b.primaryColor}30)` }} />
                        <p className="text-[10px] font-bold uppercase tracking-widest px-3 pt-2.5 pb-1" style={{ color: adaptiveText, opacity: 0.5 }}>{block.title || "Documentation"}</p>
                        <div>
                          {pages.map((p, pi) => (
                            <a
                              key={pi}
                              href={p.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-3 px-3 py-2.5 transition-opacity hover:opacity-80 active:opacity-50"
                              style={{ color: adaptiveText, borderTop: pi > 0 ? `1px solid ${adaptiveText}10` : undefined }}
                            >
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${b.primaryColor}18` }}>
                                <BookOpenIcon className="size-3.5" style={{ color: b.primaryColor }} />
                              </div>
                              <span className="flex-1 text-xs font-semibold truncate capitalize">{pageLabel(p)}</span>
                              <ExternalLinkIcon className="size-3.5 opacity-25 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )
                  }

                  if (block.type === "faq") {
                    const pairs = [1, 2, 3]
                      .map(i => ({ q: c[`q${i}`], a: c[`a${i}`] }))
                      .filter(p => p.q && p.a)
                    if (pairs.length === 0) return null
                    return (
                      <div key={block.id} className="space-y-1.5">
                        {block.title && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-0.5 h-3 rounded-full shrink-0" style={{ backgroundColor: b.primaryColor }} />
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: adaptiveText, opacity: 0.5 }}>{block.title}</p>
                          </div>
                        )}
                        {pairs.map((pair, i) => (
                          <FaqItem
                            key={i}
                            q={pair.q}
                            a={pair.a}
                            secondaryColor={b.secondaryColor}
                            backgroundColor={b.backgroundColor}
                          />
                        ))}
                      </div>
                    )
                  }

                  if (block.type === "dexscreener" && c.url) {
                    let embedUrl: string
                    if (c.url.includes("dextools.io")) {
                      // Convert DexTools pair-explorer URL to widget-chart URL
                      // e.g. /app/en/ether/pair-explorer/0x… → /widget-chart/en/ether/pe-light/0x…
                      embedUrl = c.url
                        .replace("/app/", "/widget-chart/")
                        .replace("/pair-explorer/", "/pe-light/")
                        .split("?")[0] +
                        "?theme=dark&chartType=2&chartResolution=1D&drawingToolbars=false"
                    } else {
                      // DexScreener embed. trades=0 hides the transactions table
                      // (unusable at widget width) so only the chart shows.
                      embedUrl = c.url.includes("?")
                        ? `${c.url}&embed=1&theme=dark&info=0&trades=0`
                        : `${c.url}?embed=1&theme=dark&info=0&trades=0`
                    }
                    return (
                      <div key={block.id}>
                        {block.title && (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-0.5 h-3 rounded-full shrink-0" style={{ backgroundColor: b.primaryColor }} />
                            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: adaptiveText, opacity: 0.5 }}>{block.title}</p>
                          </div>
                        )}
                        <div className="rounded-xl overflow-hidden" style={{ height: "460px" }}>
                          <iframe src={embedUrl} className="w-full h-full border-0" title={block.title || "Token Chart"} />
                        </div>
                      </div>
                    )
                  }

                  return null
                })}
              </div>
            )}

            {!config.token && (config.contentBlocks ?? []).length === 0 && (
              <div className="flex h-full items-center justify-center py-12">
                <p className="text-xs opacity-40">No protocol info configured.</p>
              </div>
            )}

            {!config.hidePoweredBy && (
              <div className="pt-2 text-center">
                <p className="text-[9px] opacity-30">Powered by TxID</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
