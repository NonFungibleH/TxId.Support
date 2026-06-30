"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Script from "next/script"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { ArrowRight, Wallet, RotateCcw, Send, AlertCircle, CheckCircle2, ChevronDown, Loader2 } from "lucide-react"
import { APP_URL } from "@/lib/config"
import { clsx } from "clsx"

// ── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support"
const DEMO_KEY = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY ?? ""
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""

const CHAINS = [
  { id: "1",     name: "Ethereum",  logo: "/chains/Ethereum.png" },
  { id: "8453",  name: "Base",      logo: "/chains/Base.png"     },
  { id: "42161", name: "Arbitrum",  logo: "/chains/Arbitrum.png" },
  { id: "137",   name: "Polygon",   logo: "/chains/Polygon.png"  },
  { id: "10",    name: "Optimism",  logo: "/chains/Optimism.png" },
  { id: "56",    name: "BNB Chain", logo: "/chains/BNB.png"      },
]


// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  toolCall?: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 shrink-0 mt-0.5 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/txid-icon-64.png" alt="TxID Support" className="w-full h-full object-cover" />
    </div>
  )
}

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  return (
    <div className={clsx("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <AgentAvatar />}
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-accent text-white rounded-br-sm"
            : "bg-[#0f0f1a] border border-[#1e1e3a] text-[#94a3b8] rounded-bl-sm"
        )}
      >
        {msg.toolCall ? (
          <span className="inline-flex items-center gap-1.5 opacity-70 text-xs">
            <Loader2 className="w-3 h-3 animate-spin" />
            {msg.toolCall === "get_wallet_balance" && "Checking your balance…"}
            {msg.toolCall === "get_recent_transactions" && "Looking up your transactions…"}
            {msg.toolCall === "get_transaction_by_hash" && "Fetching transaction details…"}
            {!["get_wallet_balance","get_recent_transactions","get_transaction_by_hash"].includes(msg.toolCall) && "Looking up on-chain data…"}
          </span>
        ) : msg.content ? (
          <>
            {msg.content}
            {msg.streaming && (
              <span className="inline-block w-1 h-3.5 bg-accent/60 ml-0.5 animate-pulse align-middle" />
            )}
          </>
        ) : msg.streaming ? (
          <span className="inline-flex items-center gap-1 opacity-60">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
          </span>
        ) : null}
      </div>
    </div>
  )
}

// ── Turnstile token helper ────────────────────────────────────────────────────

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, params: Record<string, unknown>) => string
      getResponse: (widgetId?: string) => string | undefined
      reset: (widgetId?: string) => void
    }
  }
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CheckPage() {
  const [step, setStep] = useState<"connect" | "chat">("connect")
  const [wallet, setWallet] = useState("")
  const [chainId, setChainId] = useState("1")
  const [manualAddress, setManualAddress] = useState("")
  const [connectError, setConnectError] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [chainOpen, setChainOpen] = useState(false)

  const sessionId = useRef(crypto.randomUUID())
  const messagesEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const turnstileContainerRef = useRef<HTMLDivElement>(null)

  const chain = CHAINS.find(c => c.id === chainId) ?? CHAINS[0]

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // ── Render Turnstile widget when script loads ─────────────────────────────

  function renderTurnstile() {
    if (!window.turnstile || !TURNSTILE_SITE_KEY || !turnstileContainerRef.current || turnstileWidgetId.current) return
    turnstileWidgetId.current = window.turnstile.render(turnstileContainerRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      size: "invisible",
    })
  }

  function getTurnstileToken(): string {
    if (!window.turnstile || !turnstileWidgetId.current) return ""
    const token = window.turnstile.getResponse(turnstileWidgetId.current) ?? ""
    if (token) window.turnstile.reset(turnstileWidgetId.current)
    return token
  }

  // ── Send to API ───────────────────────────────────────────────────────────

  const sendToAI = useCallback(async (userText: string) => {
    const assistantId = crypto.randomUUID()
    setMessages(prev => [
      ...prev,
      { role: "user", content: userText },
      { role: "assistant", content: "", streaming: true, toolCall: null },
    ])
    setLoading(true)

    try {
      const turnstileToken = getTurnstileToken()
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: DEMO_KEY,
          sessionId: sessionId.current,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userText },
          ],
          walletAddress: wallet || manualAddress || undefined,
          chainId,
          ...(turnstileToken ? { turnstileToken } : {}),
        }),
      })

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error ?? "API error")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ""
      let assistantText = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split("\n")
        buf = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (raw === "[DONE]") break
          try {
            const parsed = JSON.parse(raw) as {
              text?: string
              tool_call?: string
              error?: string
              suggestions?: { items: string[] }
            }
            if (parsed.error) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: "assistant", content: `Error: ${parsed.error}`, streaming: false }
                return next
              })
              break
            }
            if (parsed.tool_call) {
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { ...next[next.length - 1], toolCall: parsed.tool_call ?? null }
                return next
              })
            }
            if (parsed.text) {
              assistantText += parsed.text
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: "assistant", content: assistantText, streaming: true, toolCall: null }
                return next
              })
            }
          } catch { /* partial chunk */ }
        }
      }

      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: "assistant", content: assistantText || "Sorry, I didn't get a response. Please try again.", streaming: false, toolCall: null }
        return next
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again."
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: "assistant", content: msg, streaming: false, toolCall: null }
        return next
      })
    } finally {
      setLoading(false)
      void assistantId // suppress unused warning
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, manualAddress, chainId, messages])

  // ── Enter chat — show greeting without API call ───────────────────────────

  function enterChat(addr: string) {
    const displayChain = chain.name
    const short = shortAddr(addr)
    setMessages([{
      role: "assistant",
      content: `Hi! I'm TxID Support. I can see your wallet ${short} is connected on ${displayChain}.\n\nWhat's going on — did a transaction fail, are funds missing, or is something else not looking right?`,
    }])
    setStep("chat")
  }

  // ── Wallet connect ────────────────────────────────────────────────────────

  async function connectMetaMask() {
    setConnectError("")
    const eth = (window as unknown as { ethereum?: { request: (a: { method: string }) => Promise<string[]> } }).ethereum
    if (!eth) {
      setConnectError("No wallet detected. Install MetaMask, or enter your address manually below.")
      return
    }
    try {
      const accounts = await eth.request({ method: "eth_requestAccounts" }) as string[]
      setWallet(accounts[0])
      enterChat(accounts[0])
    } catch {
      setConnectError("Wallet connection was rejected.")
    }
  }

  function goWithManual() {
    const addr = manualAddress.trim()
    if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) {
      setConnectError("Enter a valid Ethereum address (0x…)")
      return
    }
    enterChat(addr)
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function handleSend(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput("")
    await sendToAI(msg)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function reset() {
    setStep("connect")
    setWallet("")
    setManualAddress("")
    setMessages([])
    setConnectError("")
    sessionId.current = crypto.randomUUID()
    if (window.turnstile && turnstileWidgetId.current) {
      window.turnstile.reset(turnstileWidgetId.current)
    }
  }

  // ── Connect step ──────────────────────────────────────────────────────────

  if (step === "connect") {
    return (
      <>
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js"
          onLoad={renderTurnstile}
        />
        <Navbar />
        <main className="min-h-screen pt-28 pb-24">
          <div className="max-w-xl mx-auto px-6">

            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-mono text-accent mb-5">
                <CheckCircle2 className="w-3 h-3" /> Free · No sign-up · No private keys
              </span>
              <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
                Diagnose any crypto transaction
              </h1>
              <p className="text-muted text-base leading-relaxed">
                Connect your wallet and ask TxID Support anything — why a transaction failed, where your tokens went, what a revert reason means.
              </p>
            </div>

            <div className="rounded-2xl border border-[#1e1e3a] bg-[#0f0f1a] p-8 space-y-6">

              <button
                onClick={connectMetaMask}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-accent hover:bg-accent/90 active:bg-accent/80 text-white font-semibold py-3.5 transition-colors"
              >
                <Wallet className="w-4 h-4" />
                Connect Wallet
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-[#1e1e3a]" />
                <span className="text-xs text-muted font-mono">or enter address</span>
                <div className="flex-1 h-px bg-[#1e1e3a]" />
              </div>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="0x1a2b3c4d…"
                  value={manualAddress}
                  onChange={e => { setManualAddress(e.target.value); setConnectError("") }}
                  onKeyDown={e => e.key === "Enter" && goWithManual()}
                  className="w-full bg-[#07070d] border border-[#1e1e3a] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />

                <div className="relative">
                  <button
                    onClick={() => setChainOpen(o => !o)}
                    className="w-full flex items-center justify-between gap-2 bg-[#07070d] border border-[#1e1e3a] rounded-xl px-4 py-3 text-sm text-white hover:border-accent/50 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={chain.logo} alt={chain.name} className="w-4 h-4 object-contain rounded-full" />
                      {chain.name}
                    </span>
                    <ChevronDown className={clsx("w-4 h-4 text-muted transition-transform", chainOpen && "rotate-180")} />
                  </button>
                  {chainOpen && (
                    <div className="absolute z-10 mt-1 w-full rounded-xl bg-[#0f0f1a] border border-[#1e1e3a] overflow-hidden shadow-xl">
                      {CHAINS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setChainId(c.id); setChainOpen(false) }}
                          className={clsx(
                            "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-accent/10 transition-colors",
                            c.id === chainId ? "text-accent" : "text-muted"
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.logo} alt={c.name} className="w-4 h-4 object-contain rounded-full" />
                          {c.name}
                          {c.id === chainId && <CheckCircle2 className="w-3 h-3 ml-auto" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={goWithManual}
                  disabled={!manualAddress}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#1e1e3a] bg-transparent text-white text-sm font-semibold py-3 hover:border-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Analyse address
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {connectError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-950/40 border border-red-900/40 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{connectError}</p>
                </div>
              )}

              {!DEMO_KEY && (
                <p className="text-center text-xs text-muted/60">
                  Live AI not configured — set <code className="font-mono">NEXT_PUBLIC_DEMO_WIDGET_KEY</code> to enable.
                </p>
              )}
            </div>

            <p className="text-center text-xs text-muted/50 mt-8">
              Reads on-chain data only · Private keys never required · Powered by{" "}
              <span className="text-accent font-mono">TxID Support</span>
            </p>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  // ── Chat step ─────────────────────────────────────────────────────────────

  const displayAddr = wallet || manualAddress

  return (
    <>
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        onLoad={renderTurnstile}
      />
      {/* Invisible Turnstile widget */}
      <div ref={turnstileContainerRef} className="hidden" />

      <Navbar />
      <main className="min-h-screen flex flex-col pt-16">

        {/* Wallet bar */}
        <div className="border-b border-[#1e1e3a] bg-[#0a0a12]">
          <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/60" />
              <span className="text-xs font-mono text-muted">{shortAddr(displayAddr)}</span>
              <span className="text-muted/40">·</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={chain.logo} alt={chain.name} className="w-3.5 h-3.5 object-contain rounded-full" />
              <span className="text-xs text-muted">{chain.name}</span>
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Change wallet
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-5">

            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} />
            ))}

            <div ref={messagesEnd} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-[#1e1e3a] bg-[#0a0a12]">
          <div className="max-w-3xl mx-auto px-6 py-4">
            <div className="flex items-end gap-3 bg-[#0f0f1a] rounded-2xl border border-[#1e1e3a] focus-within:border-accent/40 transition-colors px-4 py-3">
              <textarea
                ref={inputRef}
                rows={1}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything…"
                disabled={loading}
                className="flex-1 bg-transparent resize-none text-sm text-white placeholder:text-muted focus:outline-none leading-relaxed max-h-40 disabled:opacity-50"
                style={{ scrollbarWidth: "none" }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-accent text-white p-2 hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted/40 text-center mt-2 font-mono">
              Reads public on-chain data only · Never asks for seed phrases or private keys
            </p>
          </div>
        </div>

        {/* Protocol CTA */}
        <div className="border-t border-[#1e1e3a] bg-[#07070d]">
          <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Want this inside your protocol?</p>
              <p className="text-xs text-muted mt-0.5">Embed wallet-aware AI support in your app — one script tag.</p>
            </div>
            <Link
              href={`${APP_URL}/sign-up`}
              className="flex items-center gap-2 rounded-full bg-accent hover:bg-accent/90 text-white text-sm font-semibold px-5 py-2.5 transition-colors whitespace-nowrap shrink-0"
            >
              Add to your protocol
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
