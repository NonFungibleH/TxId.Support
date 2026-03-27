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
  token: { symbol: string | null; chain: string; dexUrl: string | null } | null
  watchedContracts: WatchedContract[]
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  streaming?: boolean
}

type Tab = "chat" | "wallet" | "info"

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

// ─── Main component ──────────────────────────────────────────────────────────

export function WidgetApp() {
  const params = useSearchParams()
  const apiKey = params.get("key") ?? ""

  const [config, setConfig] = useState<WidgetConfig | null>(null)
  const [configError, setConfigError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("chat")

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
          setMessages([
            {
              id: nanoid(),
              role: "assistant",
              content: `Hi! I'm here to help with ${data.projectName}. Ask me about the protocol, token, smart contracts, or transactions.`,
            },
          ])
        }
      })
      .catch(() => setConfigError("Failed to load widget config"))
  }, [apiKey])

  // ── Auto-scroll to latest message ───────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // ── Connect wallet ───────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (typeof window === "undefined" || !("ethereum" in window)) return
    const eth = (window as unknown as { ethereum: { request: (a: { method: string }) => Promise<string[]> } }).ethereum
    setWalletConnecting(true)
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" })
      const chain = await eth.request({ method: "eth_chainId" }) as unknown as string[]
      setWalletAddress(accounts[0])
      setChainId(chain as unknown as string)
    } catch {
      // user rejected
    } finally {
      setWalletConnecting(false)
    }
  }, [])

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
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.text) {
              accumulated += parsed.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: accumulated } : m,
                ),
              )
            }
          } catch {
            // ignore malformed chunks
          }
        }
      }

      // Mark streaming complete
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
  const hasWallet = typeof window !== "undefined" && "ethereum" in window

  // CSS variables for branding — applied to the root container
  const cssVars = {
    "--w-primary": b.primaryColor,
    "--w-secondary": b.secondaryColor,
    "--w-bg": b.backgroundColor,
    "--w-text": b.textColor,
    "--w-border": `${b.primaryColor}33`,
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
        {walletAddress && (
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
        {(["chat", "wallet", "info"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex flex-1 items-center justify-center gap-1.5 py-2.5 capitalize transition-opacity"
            style={{
              opacity: tab === t ? 1 : 0.5,
              borderBottom: tab === t ? `2px solid ${b.primaryColor}` : "2px solid transparent",
              color: b.textColor,
            }}
          >
            {t === "chat" && <MessageCircleIcon className="size-3.5" />}
            {t === "wallet" && <WalletIcon className="size-3.5" />}
            {t === "info" && <InfoIcon className="size-3.5" />}
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {/* Chat tab */}
        {tab === "chat" && (
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
        {tab === "wallet" && (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center">
            {walletAddress ? (
              <>
                <div
                  className="flex size-12 items-center justify-center rounded-full"
                  style={{ backgroundColor: b.primaryColor }}
                >
                  <WalletIcon className="size-5" style={{ color: b.textColor }} />
                </div>
                <div>
                  <p className="text-xs opacity-60">Connected wallet</p>
                  <p className="mt-1 font-mono text-sm break-all">{walletAddress}</p>
                  {chainId && <p className="mt-0.5 text-xs opacity-50">Chain: {chainId}</p>}
                </div>
                <p className="text-xs opacity-50">Switch to the Chat tab to ask questions about your wallet.</p>
              </>
            ) : hasWallet ? (
              <>
                <WalletIcon className="size-8 opacity-40" />
                <p className="text-sm opacity-70">Connect your wallet to get personalised support</p>
                <button
                  onClick={connectWallet}
                  disabled={walletConnecting}
                  className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
                  style={{ backgroundColor: b.primaryColor, color: b.textColor }}
                >
                  {walletConnecting ? "Connecting…" : "Connect Wallet"}
                </button>
              </>
            ) : (
              <>
                <WalletIcon className="size-8 opacity-30" />
                <p className="text-sm opacity-60">No wallet detected</p>
                <p className="text-xs opacity-40">Install MetaMask or another Web3 wallet to connect.</p>
              </>
            )}
          </div>
        )}

        {/* Info tab */}
        {tab === "info" && (
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
