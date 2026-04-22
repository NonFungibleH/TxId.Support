"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { nanoid } from "nanoid"
import {
  SendIcon,
  WalletIcon,
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
}

interface WatchedContract {
  id: string
  name: string
  address: string
  chain: string
  description: string
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

// ─── Session ID (persisted per origin+key) ───────────────────────────────────

function getSessionId(key: string): string {
  const storageKey = `txid_session_${key}`
  let id = sessionStorage.getItem(storageKey)
  if (!id) {
    id = nanoid()
    sessionStorage.setItem(storageKey, id)
  }
  return id
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

  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [tab, setTab] = useState<string>("chat")

  // Chat state
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const sessionId = useRef(apiKey ? getSessionId(apiKey) : nanoid())
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Wallet state
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [chainId, setChainId] = useState<string | null>(null)
  const [walletConnecting, setWalletConnecting] = useState(false)

  // Wallet setup flow: prompt → (connected | manual | skipped)
  const [walletSetup, setWalletSetup] = useState<"prompt" | "manual-input" | "connected" | "manual" | "skipped">("prompt")
  const [manualInput, setManualInput] = useState("")
  const [manualInputError, setManualInputError] = useState<string | null>(null)

  // Token mode state
  const [dexData, setDexData] = useState<DexPair | null>(null)
  const [dexLoading, setDexLoading] = useState(false)

  // ── Load config ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!apiKey) {
      setConfigError("No API key provided")
      return
    }
    fetch(`/api/widget-config/${apiKey}`)
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
  }, [apiKey])

  // ── Auto-scroll to latest message ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
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

    if (session.setup === "skipped") {
      setWalletSetup("skipped")
    } else if ((session.setup === "connected" || session.setup === "manual") && session.address) {
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
              }
              // If no accounts, stay on prompt to re-connect
            })
            .catch(() => { /* stay on prompt */ })
        }
      } else {
        // Manual address — restore directly, no fetch needed
        setWalletAddress(session.address)
        setChainId(session.chainId ?? "0x1")
        setWalletSetup("manual")
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

  // ── Confirm manually entered address ─────────────────────────────────────
  const confirmManualAddress = useCallback(() => {
    const addr = manualInput.trim()
    if (!/^0x[0-9a-fA-F]{40}$/i.test(addr)) {
      setManualInputError("Enter a valid Ethereum address (0x…)")
      return
    }
    setManualInputError(null)
    const lowerAddr = addr.toLowerCase()
    const cId = "0x1" // Default to Ethereum mainnet for manually entered addresses
    setWalletAddress(lowerAddr)
    setChainId(cId)
    setWalletSetup("manual")
    saveWalletSession(apiKey, { setup: "manual", address: lowerAddr, chainId: cId })
  }, [manualInput, apiKey])

  // ── Disconnect / reset wallet ────────────────────────────────────────────
  const disconnectWallet = useCallback(() => {
    setWalletAddress(null)
    setChainId(null)
    setWalletSetup("prompt")
    setManualInput("")
    setManualInputError(null)
    try { sessionStorage.removeItem(`txid_wallet_${apiKey}`) } catch { /* ignore */ }
  }, [apiKey])

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming || !config) return

    const userMsg: Message = { id: nanoid(), role: "user", content: input.trim() }
    const assistantId = nanoid()
    const assistantMsg: Message = { id: assistantId, role: "assistant", content: "", streaming: true }

    const history = [...messages, userMsg]
    setMessages([...history, assistantMsg])
    setInput("")
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
            const parsed = JSON.parse(payload) as { text?: string; tool_call?: string; error?: string }
            if (parsed.tool_call) {
              // Claude is fetching blockchain data — show tool indicator
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, toolCall: parsed.tool_call } : m,
                ),
              )
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
  }, [input, isStreaming, config, messages, apiKey, walletAddress, chainId])

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

  const TABS = isTokenMode
    ? [
        { id: "trade",     label: "Trade" },
        { id: "community", label: "Community" },
        { id: "ask",       label: "Ask" },
      ]
    : [
        { id: "chat",   label: "Chat",   icon: MessageCircleIcon },
        { id: "wallet", label: "Wallet", icon: WalletIcon },
        { id: "info",   label: "Info",   icon: InfoIcon },
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
    <div className="flex h-screen flex-col overflow-hidden" style={cssVars}>
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
        {walletAddress && !isTokenMode && (
          <span className="rounded-full px-2 py-0.5 text-[10px] font-mono" style={{ backgroundColor: b.secondaryColor, color: b.textColor }}>
            {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
          </span>
        )}
      </div>

      {/* Tab bar */}
      <div
        className="flex shrink-0 border-b text-xs"
        style={{ borderColor: `var(--w-border)` }}
      >
        {TABS.map((t) => (
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
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">

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
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {messages.length === 0 && (
                <div
                  key="init-ask"
                  className="flex items-start gap-2"
                >
                  <div
                    className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                  >
                    AI
                  </div>
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
                    <div
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                    >
                      AI
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor: m.role === "user" ? b.primaryColor : b.secondaryColor,
                      color: b.textColor,
                      borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                    }}
                  >
                    {m.content || (m.streaming && (
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
            <div
              className="shrink-0 flex items-center gap-2 border-t px-3 py-2"
              style={{ borderColor: `var(--w-border)` }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask anything…"
                disabled={isStreaming}
                className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
                style={{ color: b.textColor }}
              />
              <button
                onClick={sendMessage}
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
          <div className="flex h-full flex-col">
            <div className="flex-1 space-y-3 overflow-y-auto p-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex items-start gap-2 ${m.role === "user" ? "justify-end" : ""}`}
                >
                  {m.role === "assistant" && (
                    <div
                      className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                    >
                      AI
                    </div>
                  )}
                  <div
                    className="max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor: m.role === "user" ? b.primaryColor : b.secondaryColor,
                      color: b.textColor,
                      borderRadius: m.role === "user" ? "1rem 1rem 0.25rem 1rem" : "1rem 1rem 1rem 0.25rem",
                    }}
                  >
                    {m.content || (m.streaming && (
                      m.toolCall ? (
                        // Claude is calling a blockchain tool
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
                        // Waiting for first token
                        <span className="inline-flex items-center gap-1 opacity-60">
                          <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "0ms" }} />
                          <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "150ms" }} />
                          <span className="size-1 rounded-full animate-bounce bg-current" style={{ animationDelay: "300ms" }} />
                        </span>
                      )
                    ))}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div
              className="shrink-0 flex items-center gap-2 border-t px-3 py-2"
              style={{ borderColor: `var(--w-border)` }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                placeholder="Ask anything…"
                disabled={isStreaming}
                className="flex-1 bg-transparent text-xs outline-none placeholder:opacity-40"
                style={{ color: b.textColor }}
              />
              <button
                onClick={sendMessage}
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

        {/* Wallet tab */}
        {!isTokenMode && tab === "wallet" && (
          <div className="flex h-full flex-col overflow-y-auto">

            {/* ── Choice prompt ── */}
            {walletSetup === "prompt" && (
              <div className="flex flex-col gap-3 p-4">
                <p className="text-xs font-semibold opacity-70">Connect your wallet</p>
                <p className="text-[11px] opacity-50 -mt-1">
                  Share your wallet so the bot can diagnose transactions and check balances.
                </p>

                {/* MetaMask option */}
                <button
                  onClick={connectWallet}
                  disabled={walletConnecting || !hasMetaMask}
                  className="w-full text-left rounded-xl p-3 border transition-opacity disabled:opacity-40 active:opacity-70"
                  style={{ borderColor: `var(--w-border)`, backgroundColor: `rgba(255,255,255,0.04)` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl leading-none">🦊</span>
                    <div>
                      <p className="text-xs font-semibold">{walletConnecting ? "Connecting…" : "MetaMask"}</p>
                      <p className="text-[11px] opacity-50">
                        {hasMetaMask ? "Connect your browser wallet" : "MetaMask not detected"}
                      </p>
                    </div>
                  </div>
                </button>

                {/* Enter address option */}
                <button
                  onClick={() => setWalletSetup("manual-input")}
                  className="w-full text-left rounded-xl p-3 border transition-opacity active:opacity-70"
                  style={{ borderColor: `var(--w-border)`, backgroundColor: `rgba(255,255,255,0.04)` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl leading-none">✏️</span>
                    <div>
                      <p className="text-xs font-semibold">Enter address</p>
                      <p className="text-[11px] opacity-50">Paste any wallet address</p>
                    </div>
                  </div>
                </button>

                {/* Skip option */}
                <button
                  onClick={() => {
                    setWalletSetup("skipped")
                    saveWalletSession(apiKey, { setup: "skipped", address: null, chainId: null })
                    setTab("chat")
                  }}
                  className="w-full text-left rounded-xl p-3 border transition-opacity active:opacity-70"
                  style={{ borderColor: `var(--w-border)`, backgroundColor: `rgba(255,255,255,0.04)` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl leading-none">💬</span>
                    <div>
                      <p className="text-xs font-semibold">Skip for now</p>
                      <p className="text-[11px] opacity-50">Chat without wallet data</p>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {/* ── Manual address input ── */}
            {walletSetup === "manual-input" && (
              <div className="flex flex-col gap-3 p-4">
                <button
                  onClick={() => { setWalletSetup("prompt"); setManualInputError(null) }}
                  className="flex items-center gap-1.5 text-[11px] opacity-50 hover:opacity-80 transition-opacity w-fit"
                >
                  ← Back
                </button>
                <p className="text-xs font-semibold opacity-70">Enter your wallet address</p>
                <input
                  value={manualInput}
                  onChange={(e) => { setManualInput(e.target.value); setManualInputError(null) }}
                  onKeyDown={(e) => e.key === "Enter" && void confirmManualAddress()}
                  placeholder="0x…"
                  autoFocus
                  className="w-full rounded-lg border px-3 py-2 text-xs font-mono bg-transparent outline-none placeholder:opacity-30"
                  style={{ borderColor: `var(--w-border)`, color: b.textColor }}
                />
                {manualInputError && (
                  <p className="text-[11px] text-red-400">{manualInputError}</p>
                )}
                <button
                  onClick={() => void confirmManualAddress()}
                  className="rounded-lg px-4 py-2 text-xs font-semibold transition-opacity"
                  style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                >
                  Confirm
                </button>
              </div>
            )}

            {/* ── Connected / manual state ── */}
            {(walletSetup === "connected" || walletSetup === "manual") && walletAddress && (
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <div
                    className="flex size-8 items-center justify-center rounded-full shrink-0"
                    style={{ backgroundColor: b.primaryColor }}
                  >
                    <WalletIcon className="size-4" style={{ color: b.textColor }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] opacity-50">
                      {walletSetup === "connected" ? "MetaMask connected" : "Address added"}
                    </p>
                    <p className="text-xs font-mono truncate">{walletAddress}</p>
                  </div>
                </div>

                <div
                  className="rounded-xl p-3 text-[11px]"
                  style={{ backgroundColor: `rgba(255,255,255,0.05)`, border: `1px solid var(--w-border)` }}
                >
                  <p className="opacity-60 leading-relaxed">
                    Wallet linked. Switch to Chat — the bot can now look up your balances and diagnose transactions in real time.
                  </p>
                </div>

                <button
                  onClick={disconnectWallet}
                  className="text-[11px] opacity-40 hover:opacity-70 transition-opacity text-left"
                >
                  Disconnect wallet
                </button>
              </div>
            )}

            {/* ── Skipped state ── */}
            {walletSetup === "skipped" && (
              <div className="flex flex-col gap-3 p-4">
                <WalletIcon className="size-7 opacity-30" />
                <p className="text-xs opacity-60">No wallet connected</p>
                <p className="text-[11px] opacity-40 leading-relaxed">
                  The bot can still answer general questions. Connect a wallet for personalised transaction support.
                </p>
                <button
                  onClick={disconnectWallet}
                  className="w-fit rounded-lg px-3 py-1.5 text-xs font-medium border transition-opacity"
                  style={{ borderColor: `var(--w-border)`, color: b.textColor }}
                >
                  Connect wallet
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

            {!config.token && config.watchedContracts.length === 0 && (
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
