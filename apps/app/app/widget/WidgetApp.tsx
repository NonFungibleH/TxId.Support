"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { nanoid } from "nanoid"
import DOMPurify from "dompurify"
import {
  SendIcon,
  MessageCircleIcon,
  InfoIcon,
  Loader2Icon,
  AlertCircleIcon,
  ExternalLinkIcon,
} from "lucide-react"

// ─── Types ──────────────────────────────────────────────────────────────────

interface BrandingConfig {
  primaryColor: string
  secondaryColor: string
  backgroundColor: string
  textColor: string
  font: string
  logoUrl: string | null
  theme: "dark" | "light"
  agentName?: string | null
  agentIconUrl?: string | null
}

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
  token: { symbol: string | null; chain: string; dexUrl: string | null; address: string } | null
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
  contentBlocks?: ContentBlockData[]
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
  /** Tool currently being called — shown while Claude fetches blockchain data */
  toolCall?: string | null
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
  if (n == null) return "—"
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

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  if (parts.length === 1) return text
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          return <strong key={i}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              style={{
                fontFamily: "monospace",
                fontSize: "0.85em",
                background: "rgba(0,0,0,0.25)",
                padding: "0 3px",
                borderRadius: "3px",
              }}
            >
              {part.slice(1, -1)}
            </code>
          )
        }
        return part
      })}
    </>
  )
}

function MessageContent({
  text,
  primaryColor,
  textColor,
}: {
  text: string
  primaryColor: string
  textColor: string
}) {
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
            whiteSpace: "pre",
            margin: 0,
          }}
        >
          {codeLines.join("\n")}
        </pre>,
      )
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
                  color: textColor,
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


// ─── Wallet session helpers (module-level, no component state) ───────────────

type WalletSession = {
  setup: "connected" | "manual" | "skipped"
  address: string | null
  chainId: string | null
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

// ─── Main component ──────────────────────────────────────────────────────────

export function WidgetApp() {
  const params = useSearchParams()
  const apiKey = params?.get("key") ?? ""
  const isPreview = params?.get("preview") === "1"
  const previewToken = params?.get("pt") ?? undefined

  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>("chat")

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const sessionId = useRef<string>(nanoid())
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [walletConnecting, setWalletConnecting] = useState(false)

  // Wallet setup flow: prompt → (connected | manual | skipped)
  const [, setWalletSetup] = useState<"prompt" | "manual-input" | "connected" | "manual" | "skipped">("prompt")

  // Ticket escalation state
  const [escalation, setEscalation] = useState<{ summary: string; reason: string } | null>(null)
  const [ticketName, setTicketName] = useState("")
  const [ticketEmail, setTicketEmail] = useState("")
  const [ticketSubmitting, setTicketSubmitting] = useState(false)
  const [ticketRef, setTicketRef] = useState<string | null>(null)

  // Per-message feedback (thumbs up/down)
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 1 | -1>>({})

  // Quick-reply suggestion chips
  const [suggestions, setSuggestions] = useState<string[]>([])

  // Token mode state
  const [dexData, setDexData] = useState<DexPair | null>(null)
  const [dexLoading, setDexLoading] = useState(false)


  // ── Load config ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) {
      setConfigError("No API key provided")
      return
    }
    fetch(`/api/widget-config/${apiKey}${isPreview ? `?preview=1&pt=${previewToken ?? ""}` : ""}`)
      .then((r) => r.json())
      .then((data: WidgetConfig | { error: string }) => {
        if ("error" in data) setConfigError(data.error)
        else {
          setConfig(data)
          const isToken = data.mode === "token"
          setTab(isToken ? "trade" : "chat")
          if (!isToken) {
            setMessages([
              {
                id: nanoid(),
                role: "assistant",
                content: `Hi! I'm here to help with ${data.projectName}. Ask me about the protocol, token, smart contracts, or transactions.`,
              },
            ])
          }
        }
      })
      .catch(() => setConfigError("Failed to load widget config"))
  }, [apiKey, isPreview, previewToken])

  // ── Auto-scroll to latest message ───────────────────────────────────────
  useEffect(() => {
    const el = messagesContainerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

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
        // silently fail — fallback state shown
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

    if ((session.setup === "connected" || session.setup === "manual") && session.address) {
      if (session.setup === "connected") {
        // Try to silently re-connect MetaMask (no popup)
        const win = window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }
        if (win.ethereum) {
          win.ethereum.request({ method: "eth_accounts" })
            .then((accounts) => {
              if (accounts[0]) {
                setWalletAddress(accounts[0])
                setChainId(session.chainId ?? "0x1")
                setWalletSetup("connected")
                setTab("chat")
              }
            })
            .catch(() => { /* stay on prompt */ })
        }
      } else {
        // Manual address — restore directly, no fetch needed
        setWalletAddress(session.address)
        setChainId(session.chainId ?? "0x1")
        setWalletSetup("manual")
        setTab("chat")
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey, config])

  // ── Connect wallet ───────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined" || !("ethereum" in window)) return
    const eth = (window as unknown as { ethereum: { request: (a: { method: string }) => Promise<string[]> } }).ethereum
    setWalletConnecting(true)
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" })
      const chain = await eth.request({ method: "eth_chainId" }) as unknown as string[]
      const addr = accounts[0]
      const cId = chain as unknown as string
      setWalletAddress(addr)
      setChainId(cId)
      setWalletSetup("connected")
      saveWalletSession(apiKey, { setup: "connected", address: addr, chainId: cId })
    } catch {
      // user rejected
    } finally {
      setWalletConnecting(false)
    }
  }, [apiKey])


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
          reason: escalation.reason,
          conversation: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      })
      const data = (await res.json()) as { ref?: string; error?: string }
      if (data.ref) {
        setTicketRef(data.ref)
        setMessages(prev => [...prev, {
          id: nanoid(),
          role: "assistant" as const,
          content: `Ticket ${data.ref} has been raised — the team will be in touch at ${ticketEmail.trim()}.`,
          streaming: false,
        }])
      }
    } catch {
      // non-fatal
    } finally {
      setTicketSubmitting(false)
    }
  }, [escalation, ticketName, ticketEmail, apiKey, messages])

  // ── Message feedback (thumbs up/down) ────────────────────────────────────
  const submitFeedback = useCallback(async (messageId: string, value: 1 | -1) => {
    setMessageFeedback((prev) => ({ ...prev, [messageId]: value }))
    try {
      await fetch(`${apiUrl}/api/widget/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: apiKey, sessionId: sessionId.current, feedback: value }),
      })
    } catch { /* non-fatal */ }
    // Thumbs down → surface escalation after a short pause
    if (value === -1) {
      setTimeout(() => {
        setEscalation({ summary: "A response wasn't helpful.", reason: "user_requested" })
      }, 600)
    }
  }, [apiKey, apiUrl])

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (textArg?: string) => {
    const msgText = (textArg ?? input).trim()
    if (!msgText || isStreaming || !config) return

    const userMsg: Message = { id: nanoid(), role: "user", content: msgText }
    const assistantId = nanoid()
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true }

    const history = [...messages, userMsg]
    setMessages([...history, assistantMsg])
    if (!textArg) setInput("")
    setSuggestions([])
    setIsStreaming(true)

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
        }),
      })

      if (!res.ok || !res.body) throw new Error("Stream failed")

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
              // AI wants to raise a ticket — end stream and show form
              setMessages((prev) =>
                prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
              )
              setEscalation(parsed.escalate)
              setIsStreaming(false)
              return
            }
            if (parsed.tool_call) {
              // Claude is fetching blockchain data — show tool indicator
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, toolCall: parsed.tool_call } : m,
                ),
              )
            }
            if (parsed.suggestions?.items?.length) {
              setSuggestions(parsed.suggestions.items)
            }
            if (parsed.text) {
              // Text is streaming — clear any tool indicator
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

      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)),
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again.", streaming: false }
            : m,
        ),
      )
    } finally {
      setIsStreaming(false)
    }
  }, [input, isStreaming, config, messages, apiKey, walletAddress, chainId, isPreview, previewToken])

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

  // ── Error state ──────────────────────────────────────────────────────────
  if (configError) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950 p-4">
        <div className="flex items-center gap-2 text-sm text-red-400">
          <AlertCircleIcon className="size-4 shrink-0" />
          {configError}
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-950">
        <Loader2Icon className="size-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  const b = config.branding
  const isTokenMode = config.mode === "token"
  const hasMetaMask = typeof window !== "undefined" && "ethereum" in window

  const hasContentBlocks = (config.contentBlocks ?? []).length > 0

  const TABS = isTokenMode
    ? [
        { id: "trade",     label: "Trade" },
        { id: "community", label: "Community" },
        { id: "ask",       label: "Ask" },
      ]
    : [
        { id: "chat", label: "Chat", icon: MessageCircleIcon },
        ...(hasContentBlocks ? [{ id: "info", label: "Info", icon: InfoIcon }] : []),
      ]

  // CSS variables for branding — applied to the root container
  const cssVars = {
    "--w-primary": b.primaryColor,
    "--w-secondary": b.secondaryColor,
    "--w-bg": b.backgroundColor,
    "--w-text": b.textColor,
    "--w-border": `${b.primaryColor}33`,
    "--txid-text": b.textColor,
    "--txid-muted": `${b.textColor}80`,
    fontFamily: `'${b.font}', sans-serif`,
    backgroundColor: b.backgroundColor,
    color: b.textColor,
  } as React.CSSProperties

  return (
    <div className="flex h-full flex-col overflow-hidden" style={cssVars}>
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
            style={{ backgroundColor: b.secondaryColor, color: b.textColor }}
          >
            {config.projectName.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="flex-1 text-sm font-semibold" style={{ color: b.textColor }}>
          {config.projectName}
        </span>
        {!isTokenMode && (
          walletAddress ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-mono" style={{ backgroundColor: b.secondaryColor, color: b.textColor }}>
              {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
            </span>
          ) : hasMetaMask ? (
              <button
                onClick={connectWallet}
                disabled={walletConnecting}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity disabled:opacity-40 active:opacity-70"
                style={{ backgroundColor: b.secondaryColor, color: b.textColor }}
              >
                {walletConnecting ? "Connecting…" : "Connect wallet"}
              </button>
            ) : (
              <button
                onClick={() => setWalletSetup("manual-input")}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium transition-opacity active:opacity-70"
                style={{ backgroundColor: b.secondaryColor, color: b.textColor }}
              >
                Enter address
              </button>
            )
        )}
      </div>

      {/* Tab bar */}
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
                opacity: tab === t.id ? 1 : 0.5,
                borderBottom: tab === t.id ? `2px solid ${b.primaryColor}` : "2px solid transparent",
                color: b.textColor,
              }}
            >
              {"icon" in t && t.icon && <t.icon className="size-3.5" />}
              {t.label}
            </button>
          )
        })}
      </div>

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
                            {price != null ? `$${price < 0.01 ? price.toExponential(4) : price.toFixed(4)}` : "—"}
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
                Price data unavailable — check DexScreener
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
                  {b.agentIconUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.agentIconUrl} alt={b.agentName || "AI"} className="size-6 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                    >
                      {b.agentName ? b.agentName.slice(0, 2).toUpperCase() : "AI"}
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor: b.secondaryColor,
                      color: b.textColor,
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
                    b.agentIconUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={b.agentIconUrl} alt={b.agentName || "AI"} className="size-6 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div
                        className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                        style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                      >
                        {b.agentName ? b.agentName.slice(0, 2).toUpperCase() : "AI"}
                      </div>
                    )
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-3 py-2 text-xs break-words"
                    style={{
                      backgroundColor: m.role === "user" ? b.primaryColor : b.secondaryColor,
                      color: b.textColor,
                      borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                      overflowWrap: "anywhere",
                    }}
                  >
                    {m.content ? (
                      m.role === "assistant" ? (
                        <MessageContent text={m.content} primaryColor={b.primaryColor} textColor={b.textColor} />
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
            {suggestions.length > 0 && !isStreaming && (
              <div className="shrink-0 flex flex-wrap gap-1.5 px-3 pb-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-[10px] rounded-full px-2.5 py-1 border transition-opacity hover:opacity-90 active:scale-95"
                    style={{
                      borderColor: `${b.primaryColor}50`,
                      color: b.textColor,
                      background: `${b.primaryColor}12`,
                      opacity: 0.75,
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
                value={input}
                onChange={(e) => { setInput(e.target.value); if (suggestions.length) setSuggestions([]) }}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask anything…"
                disabled={isStreaming}
                className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
                style={{ color: b.textColor }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={isStreaming || !input.trim()}
                className="flex size-7 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
                style={{ backgroundColor: b.primaryColor }}
              >
                {isStreaming ? (
                  <Loader2Icon className="size-3.5 animate-spin" style={{ color: b.textColor }} />
                ) : (
                  <SendIcon className="size-3.5" style={{ color: b.textColor }} />
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Support Mode tabs ─────────────────────────────────────────── */}

        {!isTokenMode && tab === "chat" && (
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
            <div ref={messagesContainerRef} className="flex-1 min-h-0 space-y-3 overflow-y-auto p-3">
              {(() => {
                const lastAiIdx = messages.reduce((acc, m, i) => m.role === "assistant" && !m.streaming && m.content ? i : acc, -1)
                return messages.map((m, idx) => (
                <div key={m.id}>
                  <div className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : ""}`}>
                    {m.role === "assistant" && (
                      b.agentIconUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.agentIconUrl} alt={b.agentName || "AI"} className="size-6 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div
                          className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                          style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                        >
                          {b.agentName ? b.agentName.slice(0, 2).toUpperCase() : "AI"}
                        </div>
                      )
                    )}
                    <div
                      className="max-w-[80%] rounded-2xl px-3 py-2 text-xs break-words"
                      style={{
                        backgroundColor: m.role === "user" ? b.primaryColor : b.secondaryColor,
                        color: b.textColor,
                        borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {m.content ? (
                        m.role === "assistant" ? (
                          <MessageContent text={m.content} primaryColor={b.primaryColor} textColor={b.textColor} />
                        ) : m.content
                      ) : (m.streaming && (
                        m.toolCall ? (
                          <span className="inline-flex items-center gap-1.5 opacity-70">
                            <Loader2Icon className="size-2.5 animate-spin" />
                            <span className="text-[11px]">
                              {m.toolCall === "get_wallet_balance" && "Checking your balance…"}
                              {m.toolCall === "get_recent_transactions" && "Looking up your transactions…"}
                              {m.toolCall === "get_transaction_by_hash" && "Fetching transaction details…"}
                              {!["get_wallet_balance","get_recent_transactions","get_transaction_by_hash"].includes(m.toolCall) && "Looking up data…"}
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
                    </div>
                  </div>
                  {/* Thumbs up/down — only on the last completed AI message */}
                  {m.role === "assistant" && !m.streaming && m.content && idx === lastAiIdx && (
                    <div className="flex items-center gap-2 mt-1 ml-8">
                      {messageFeedback[m.id] ? (
                        <span className="text-[10px]" style={{ color: b.textColor, opacity: 0.35 }}>
                          {messageFeedback[m.id] === 1 ? "👍 Helpful" : "👎 Raising a ticket…"}
                        </span>
                      ) : (
                        <>
                          <button
                            onClick={() => submitFeedback(m.id, 1)}
                            className="text-[11px] opacity-25 hover:opacity-60 transition-opacity"
                            title="Helpful"
                            style={{ color: b.textColor }}
                          >👍</button>
                          <button
                            onClick={() => submitFeedback(m.id, -1)}
                            className="text-[11px] opacity-25 hover:opacity-60 transition-opacity"
                            title="Not helpful"
                            style={{ color: b.textColor }}
                          >👎</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))
              })()}
              <div ref={messagesEndRef} />
            </div>

            {/* Ticket escalation form — shown when AI triggers escalation */}
            {escalation && (
              <div
                className="shrink-0 border-t space-y-2.5 px-3 py-3"
                style={{ borderColor: `var(--w-border)` }}
              >
                {!ticketRef ? (
                  <>
                    <div>
                      <p className="text-xs font-semibold mb-0.5">Raise a support ticket</p>
                      <p className="text-[11px] opacity-50 leading-relaxed">{escalation.summary}</p>
                    </div>
                    <input
                      type="text"
                      value={ticketName}
                      onChange={e => setTicketName(e.target.value)}
                      placeholder="Your name"
                      className="w-full bg-transparent text-xs outline-none border-b pb-1.5 placeholder:opacity-30"
                      style={{ color: b.textColor, borderColor: `var(--w-border)` }}
                    />
                    <input
                      type="email"
                      value={ticketEmail}
                      onChange={e => setTicketEmail(e.target.value)}
                      placeholder="Your email"
                      className="w-full bg-transparent text-xs outline-none border-b pb-1.5 placeholder:opacity-30"
                      style={{ color: b.textColor, borderColor: `var(--w-border)` }}
                    />
                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        onClick={submitTicket}
                        disabled={ticketSubmitting || !ticketName.trim() || !ticketEmail.trim()}
                        className="flex-1 rounded-xl py-2 text-xs font-semibold transition-opacity disabled:opacity-40"
                        style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                      >
                        {ticketSubmitting ? "Submitting…" : "Submit ticket"}
                      </button>
                      <button
                        onClick={() => { setEscalation(null); setTicketName(""); setTicketEmail("") }}
                        className="text-[11px] opacity-30 hover:opacity-60 transition-opacity"
                        style={{ color: b.textColor }}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold opacity-70">Ticket {ticketRef} created</p>
                    <p className="text-[11px] opacity-50">We&apos;ll be in touch at {ticketEmail}.</p>
                    <button
                      onClick={() => { setEscalation(null); setTicketRef(null) }}
                      className="text-[11px] opacity-40 hover:opacity-70 transition-opacity"
                      style={{ color: b.textColor }}
                    >
                      Continue chatting →
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Quick-reply chips — appear after each AI response, cleared on send */}
            {suggestions.length > 0 && !isStreaming && !escalation && (
              <div className="shrink-0 flex flex-wrap gap-1.5 px-3 pb-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-[10px] rounded-full px-2.5 py-1 border transition-opacity hover:opacity-90 active:scale-95"
                    style={{
                      borderColor: `${b.primaryColor}50`,
                      color: b.textColor,
                      background: `${b.primaryColor}12`,
                      opacity: 0.75,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Speak to a person — always available once conversation has started */}
            {!escalation && messages.length > 1 && !isStreaming && (
              <div className="shrink-0 flex justify-center pb-1">
                <button
                  onClick={() => setEscalation({ summary: "User requested to speak with a person.", reason: "user_requested" })}
                  className="text-[10px] transition-opacity hover:opacity-70"
                  style={{ color: b.textColor, opacity: 0.28 }}
                >
                  Speak to a person →
                </button>
              </div>
            )}

            {/* Input — hidden while escalation form is shown */}
            {!escalation && (
              <div
                className="shrink-0 flex items-center gap-2 border-t px-3 py-2"
                style={{ borderColor: `var(--w-border)` }}
              >
                <input
                  value={input}
                  onChange={(e) => { setInput(e.target.value); if (suggestions.length) setSuggestions([]) }}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Ask anything…"
                  disabled={isStreaming}
                  className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
                  style={{ color: b.textColor }}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={isStreaming || !input.trim()}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full transition-opacity disabled:opacity-40"
                  style={{ backgroundColor: b.primaryColor }}
                >
                  {isStreaming ? (
                    <Loader2Icon className="size-3.5 animate-spin" style={{ color: b.textColor }} />
                  ) : (
                    <SendIcon className="size-3.5" style={{ color: b.textColor }} />
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Info tab */}
        {!isTokenMode && tab === "info" && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {config.token && (
              <div
                className="rounded-xl p-3"
                style={{ backgroundColor: b.secondaryColor }}
              >
                <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">Token</p>
                <p className="text-sm font-semibold">{config.token.symbol ?? "Unknown"}</p>
                {config.token.dexUrl && (
                  <a
                    href={config.token.dexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 flex items-center gap-1 text-xs opacity-60 hover:opacity-100"
                    style={{ color: b.textColor }}
                  >
                    View on DEX <ExternalLinkIcon className="size-3" />
                  </a>
                )}
              </div>
            )}

            {config.watchedContracts.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider opacity-60 mb-2">Smart Contracts</p>
                <div className="space-y-2">
                  {config.watchedContracts.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl p-3"
                      style={{ backgroundColor: b.secondaryColor }}
                    >
                      <p className="text-xs font-semibold">{c.name}</p>
                      <p className="mt-0.5 text-[10px] opacity-60 font-mono truncate">{c.address}</p>
                      {c.description && (
                        <p className="mt-1 text-[10px] opacity-70">{c.description}</p>
                      )}
                    </div>
                  ))}
                </div>
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
                        {block.title && <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{block.title}</p>}
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
                      <div key={block.id} className="rounded-xl p-3" style={{ backgroundColor: b.secondaryColor }}>
                        {block.title && <p className="text-xs font-semibold mb-1.5">{block.title}</p>}
                        <p className="text-[11px] opacity-80 leading-relaxed whitespace-pre-wrap">{c.body}</p>
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
                        style={{ backgroundColor: b.secondaryColor, color: b.textColor }}
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate">{block.title}</p>
                          {c.description && <p className="text-[10px] opacity-60 mt-0.5">{c.description}</p>}
                        </div>
                        <ExternalLinkIcon className="size-3.5 opacity-40 shrink-0" />
                      </a>
                    )
                  }

                  if (block.type === "image" && c.url) {
                    return (
                      <div key={block.id}>
                        {block.title && <p className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{block.title}</p>}
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

                  return null
                })}
              </div>
            )}

            {!config.token && config.watchedContracts.length === 0 && (config.contentBlocks ?? []).length === 0 && (
              <div className="flex h-full items-center justify-center py-12">
                <p className="text-xs opacity-40">No protocol info configured.</p>
              </div>
            )}

            <div className="pt-2 text-center">
              <p className="text-[9px] opacity-30">Powered by TxID Support</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
