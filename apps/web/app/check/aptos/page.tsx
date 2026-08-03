"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { ArrowRight, Wallet, RotateCcw, Send, AlertCircle, Loader2 } from "lucide-react"
import { accentVars, readableText } from "@/lib/chains"
import { clsx } from "clsx"

// ── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support"
// A dedicated Aptos demo project (publicDemo flag ON in /admin). Its watched
// contracts scope the bot, so no demoProtocol expansion happens server-side.
const APTOS_DEMO_KEY = process.env.NEXT_PUBLIC_APTOS_DEMO_WIDGET_KEY ?? ""

// The page is co-branded TxID × Aptos: Aptos teal accent (matches the
// one-pager), official Aptos mark rendered white for the dark background.
const APTOS_TEAL = "#2ED3B7"

// The most-used Aptos protocols, mirroring the EVM /check picker. All four
// have per-protocol error maps in the engine; the demo project behind
// NEXT_PUBLIC_APTOS_DEMO_WIDGET_KEY watches all four package addresses, so
// the picker sets the framing while the bot is scoped server-side.
const PROTOCOLS = [
  {
    id: "decibel", name: "Decibel", color: "#22D3EE", logo: undefined as string | undefined,
    blurb: "Aptos Labs' on-chain perps DEX. Orders, collateral and subaccounts.",
    suggestions: ["Why did my order fail?", "What's my collateral?", "Show my recent trades"],
  },
  {
    id: "pancakeswap", name: "PancakeSwap", color: "#1FC7D4", logo: "/protocols/pancakeswap.png" as string | undefined,
    blurb: "The biggest DEX on Aptos. Swaps, LP and farms, all in Move.",
    suggestions: ["What was my last transaction?", "Why did my swap fail?", "What's in my wallet?"],
  },
  {
    id: "thala", name: "Thala", color: "#A78BFA", logo: undefined as string | undefined,
    blurb: "DEX and stablecoin protocol. Swaps, pools and Move Dollar.",
    suggestions: ["Why did my swap fail?", "What was my last transaction?", "What's in my wallet?"],
  },
  {
    id: "amnis", name: "Amnis", color: "#38BDF8", logo: undefined as string | undefined,
    blurb: "Liquid staking on Aptos. Stake APT, hold amAPT and stAPT.",
    suggestions: ["Show my staking positions", "Why did my transaction fail?", "What's in my wallet?"],
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  toolCall?: string | null
}

interface AptosProvider {
  connect: () => Promise<{ address: string }>
}

declare global {
  interface Window {
    aptos?: AptosProvider
    martian?: AptosProvider
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// Aptos account addresses: 0x + 1-64 hex (short forms are valid and padded
// on-chain). Deliberately mirrors the chat route's aptos branch.
const APTOS_ADDR = /^0x[0-9a-fA-F]{1,64}$/

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 shrink-0 mt-0.5 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/txid-icon-64.png" alt="TxID Support" className="w-full h-full object-cover" />
    </div>
  )
}

function ProtocolBadge({ name, color, logo, size = 40 }: { name: string; color: string; logo?: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const radius = size * 0.26
  if (logo && !failed) {
    return (
      <span
        className="inline-flex items-center justify-center shrink-0 overflow-hidden"
        style={{ width: size, height: size, borderRadius: radius }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logo}
          alt={name}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, borderRadius: radius, background: color, fontSize: size * 0.44 }}
      aria-hidden
    >
      {name.charAt(0)}
    </span>
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
            {msg.toolCall === "get_transaction_by_hash" && "Diagnosing transaction…"}
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AptosCheckPage() {
  const [step, setStep] = useState<"connect" | "chat">("connect")
  const [protocolId, setProtocolId] = useState("decibel")
  const [wallet, setWallet] = useState("")
  const [manualAddress, setManualAddress] = useState("")
  const [connectError, setConnectError] = useState("")
  const [limitReached, setLimitReached] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  // ?key=pk_… lets us smoke-test against a different demo project before the
  // env var is set. Read once on mount (client component, no SSR window).
  const [keyOverride, setKeyOverride] = useState("")

  const sessionId = useRef(crypto.randomUUID())
  const messagesEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const protocol = PROTOCOLS.find(p => p.id === protocolId) ?? PROTOCOLS[0]
  const demoKey = keyOverride || APTOS_DEMO_KEY

  const themeStyle = accentVars(APTOS_TEAL) as React.CSSProperties
  const ctaText = readableText(APTOS_TEAL)

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("key")
    if (k && /^pk_[a-f0-9]+$/i.test(k)) setKeyOverride(k)
  }, [])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // ── Send to API ───────────────────────────────────────────────────────────

  const sendToAI = useCallback(async (userText: string) => {
    setMessages(prev => [
      ...prev,
      { role: "user", content: userText },
      { role: "assistant", content: "", streaming: true, toolCall: null },
    ])
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: demoKey,
          sessionId: sessionId.current,
          messages: [
            ...messages.map(m => ({ role: m.role, content: m.content })),
            { role: "user", content: userText },
          ],
          walletAddress: wallet || manualAddress || undefined,
          chainId: "aptos",
        }),
      })

      if (!res.ok || !res.body) {
        const errData = await res.json().catch(() => ({})) as { error?: string; limitReached?: boolean }
        if (errData.limitReached) setLimitReached(true)
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
              escalate?: { reason?: string }
            }
            // The per-session message cap arrives as an `escalate` event (the
            // widget renders a ticket form for it; here it just means "this
            // chat is full"), so surface the start-a-new-chat card.
            if (parsed.escalate?.reason === "message_limit") setLimitReached(true)
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
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, manualAddress, messages, demoKey])

  // ── Enter chat ────────────────────────────────────────────────────────────

  function enterChat(addr: string) {
    setMessages([{
      role: "assistant",
      content: `Hi! I'm ${protocol.name} Support on Aptos (a live TxID demo). I can see your wallet ${shortAddr(addr)}.\n\nI can look up your recent transactions, decode a Move abort into plain English, or check what's in your wallet. Pick a suggestion below, or paste a transaction hash.`,
    }])
    setStep("chat")
  }

  // ── Wallet connect (Petra, Martian fallback) ──────────────────────────────

  async function connectAptosWallet() {
    setConnectError("")
    const provider = window.aptos ?? window.martian
    if (!provider) {
      // Mobile browsers have no injected provider. Reopen this page inside
      // Petra's in-app browser via its explore deep link.
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.href = `https://petra.app/explore?link=${encodeURIComponent(window.location.href)}`
        return
      }
      setConnectError("No Aptos wallet detected. Install Petra, or paste your address below.")
      return
    }
    try {
      const resp = await provider.connect()
      if (!resp?.address) throw new Error("no address")
      setWallet(resp.address)
      enterChat(resp.address)
    } catch {
      setConnectError("Wallet connection was rejected.")
    }
  }

  function goWithManual() {
    setConnectError("")
    const addr = manualAddress.trim()
    if (!APTOS_ADDR.test(addr)) {
      setConnectError("Enter a valid Aptos address (0x…)")
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
    setLimitReached(false)
    sessionId.current = crypto.randomUUID()
  }

  // ── Connect step ──────────────────────────────────────────────────────────

  if (step === "connect") {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-28 pb-24" style={themeStyle}>
          <div className="max-w-xl mx-auto px-6">

            <div className="text-center mb-10">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-mono text-accent mb-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/chains/Aptos.png" alt="Aptos" className="w-3.5 h-3.5 object-contain invert" />
                Live on Aptos mainnet · A few free questions · No sign-up
              </span>
              <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
                Test-drive TxID on Aptos
              </h1>
              <p className="text-muted text-base leading-relaxed">
                Connect your Aptos wallet and watch TxID diagnose your real Move transactions live: abort codes decoded, balances read from the fullnode, answers in plain English.
              </p>
            </div>

            <div className="rounded-2xl border border-[#1e1e3a] bg-[#0f0f1a] p-5 sm:p-8 space-y-6">

              {/* Protocol picker */}
              <div>
                <p className="text-xs font-mono text-muted mb-2.5">1 · Pick a protocol</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {PROTOCOLS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => { setProtocolId(p.id); setConnectError("") }}
                      className={clsx(
                        "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                        p.id === protocolId ? "border-accent bg-accent/5" : "border-[#1e1e3a] hover:border-accent/40"
                      )}
                    >
                      <ProtocolBadge name={p.name} color={p.color} logo={p.logo} size={36} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{p.name}</p>
                        <p className="text-[11px] text-muted leading-snug">{p.blurb}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Connect */}
              <div>
                <p className="text-xs font-mono text-muted mb-2.5">2 · Connect to diagnose your activity</p>
                <button
                  onClick={connectAptosWallet}
                  style={{ color: ctaText }}
                  className="w-full flex items-center justify-center gap-3 rounded-xl bg-accent hover:bg-accent/90 active:bg-accent/80 font-semibold py-3.5 transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  Connect Petra
                </button>

                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[#1e1e3a]" />
                  <span className="text-xs text-muted font-mono">or paste an address</span>
                  <div className="flex-1 h-px bg-[#1e1e3a]" />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Aptos address (0x…)"
                    value={manualAddress}
                    onChange={e => { setManualAddress(e.target.value); setConnectError("") }}
                    onKeyDown={e => e.key === "Enter" && goWithManual()}
                    className="flex-1 bg-[#07070d] border border-[#1e1e3a] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                  <button
                    onClick={goWithManual}
                    disabled={!manualAddress}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-[#1e1e3a] bg-transparent text-white text-sm font-semibold px-4 hover:border-accent hover:bg-accent/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    Go
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {connectError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-950/40 border border-red-900/40 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{connectError}</p>
                </div>
              )}

              {!demoKey && (
                <p className="text-center text-xs text-muted/60">
                  Live AI not configured. Set <code className="font-mono">NEXT_PUBLIC_APTOS_DEMO_WIDGET_KEY</code> to enable.
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
      <Navbar />
      <main className="min-h-screen flex flex-col pt-16" style={themeStyle}>

        {/* Context bar */}
        <div className="border-b border-[#1e1e3a] bg-[#0a0a12]">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-x-2 gap-y-1 flex-wrap min-w-0">
              <span className="flex items-center gap-1.5 shrink-0">
                <ProtocolBadge name={protocol.name} color={protocol.color} logo={protocol.logo} size={18} />
                <span className="text-xs font-semibold text-white">{protocol.name}</span>
              </span>
              <span className="text-muted/40 hidden sm:inline">·</span>
              <span className="flex items-center gap-1.5 shrink-0">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-500/60" />
                <span className="text-xs font-mono text-muted">{shortAddr(displayAddr)}</span>
              </span>
              <span className="text-muted/40 hidden sm:inline">·</span>
              <span className="flex items-center gap-1.5 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/chains/Aptos.png" alt="Aptos" className="w-3.5 h-3.5 object-contain invert" />
                <span className="text-xs text-muted">Aptos</span>
              </span>
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Start over
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

        {/* Input, or the sign-up wall once the free limit is hit */}
        <div className="border-t border-[#1e1e3a] bg-[#0a0a12]">
          <div className="max-w-3xl mx-auto px-6 py-4">
            {limitReached ? (
              <div className="text-center py-2">
                <p className="text-sm text-white font-medium mb-1">That&apos;s the limit for one chat.</p>
                <p className="text-xs text-muted mb-4">Start a new one to keep going, or tell us what you&apos;d like to see next.</p>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <button
                    onClick={reset}
                    style={{ color: ctaText }}
                    className="inline-flex items-center gap-2 rounded-xl bg-accent text-sm font-semibold px-5 py-2.5 hover:bg-accent/90 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Start a new chat
                  </button>
                  <a
                    href="mailto:team@txid.support?subject=TxID on Aptos"
                    className="inline-flex items-center gap-2 rounded-xl border border-[#1e1e3a] text-sm font-semibold px-5 py-2.5 text-white hover:border-accent/50 transition-colors"
                  >
                    Email the team
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            ) : (
              <>
                {messages.length <= 1 && !loading && (
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                    <span className="w-full text-center text-[11px] font-mono text-muted/50 mb-0.5">Try asking</span>
                    {protocol.suggestions.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSend(s)}
                        className="rounded-full border border-[#1e1e3a] bg-[#0f0f1a] px-3.5 py-1.5 text-xs text-[#94a3b8] hover:text-white hover:border-accent/50 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-3 bg-[#0f0f1a] rounded-2xl border border-[#1e1e3a] focus-within:border-accent/40 transition-colors px-4 py-3">
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about your Aptos activity, or paste a transaction hash…"
                    disabled={loading}
                    className="flex-1 bg-transparent resize-none text-sm text-white placeholder:text-muted focus:outline-none leading-relaxed max-h-40 disabled:opacity-50"
                    style={{ scrollbarWidth: "none" }}
                  />
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || loading}
                    style={{ color: ctaText }}
                    className="rounded-xl bg-accent p-2 hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-muted/40 text-center mt-2 font-mono">
                  Reads public on-chain data only · Never asks for seed phrases or private keys
                </p>
              </>
            )}
          </div>
        </div>

        {/* Protocol CTA */}
        <div className="border-t border-[#1e1e3a] bg-[#07070d]">
          <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Building on Aptos?</p>
              <p className="text-xs text-muted mt-0.5">This is a live test. Want your users to get the same support? We&apos;ll set you up personally.</p>
            </div>
            <a
              href="mailto:team@txid.support?subject=TxID on Aptos"
              style={{ color: ctaText }}
              className="flex items-center gap-2 rounded-full bg-accent hover:bg-accent/90 text-sm font-semibold px-5 py-2.5 transition-colors whitespace-nowrap shrink-0"
            >
              Talk to us
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </main>
    </>
  )
}
