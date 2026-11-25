"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { ArrowRight, Wallet, RotateCcw, Send, AlertCircle, Loader2, Users } from "lucide-react"
import { accentVars, readableText } from "@/lib/chains"
import { clsx } from "clsx"

// ── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support"
// A dedicated Arc demo project (publicDemo flag ON in /admin). Its watched
// contracts scope the assistant, so no demoProtocol expansion happens server-side.
const ARC_DEMO_KEY = process.env.NEXT_PUBLIC_ARC_DEMO_WIDGET_KEY ?? ""

// Arc's chain, as a wallet needs it to switch or add the network. Gas is USDC,
// held natively at 18 decimals (docs.arc.io, connect-to-arc).
const ARC_CHAIN_ID = "0x13b2"
const ARC_CHAIN_PARAMS = {
  chainId: ARC_CHAIN_ID,
  chainName: "Arc",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 18 },
  rpcUrls: ["https://rpc.mainnet.arc.io"],
  blockExplorerUrls: ["https://explorer.arc.io"],
}

// Co-branded TxID x Arc. A brighter blue than Arc's navy mark, so the accent
// keeps its contrast on the dark page.
const ARC_BLUE = "#5B8CFF"

// What people actually do on Arc, measured 2026-11-25: Uniswap carries about
// 80% of DEX volume, Aave V4 and Morpho hold most of the deposits, and almost
// every first transaction starts with getting USDC onto Arc to pay its fees.
const PROTOCOLS = [
  {
    id: "wallet", name: "Your Arc wallet", color: "#5B8CFF", logo: "/chains/Arc.jpg" as string | undefined,
    blurb: "Anything on Arc: USDC fees, failed transactions, what you hold.",
    suggestions: [
      "Why did my last transaction fail?",
      "What have I done on Arc recently?",
      "Do I have enough USDC for fees?",
      "What's in my wallet?",
    ],
  },
  {
    id: "uniswap", name: "Uniswap", color: "#FF007A", logo: "/protocols/uniswap.png" as string | undefined,
    blurb: "Most of Arc's trading volume. Swaps through the Universal Router.",
    suggestions: ["Why did my swap fail?", "What was my last transaction?", "Do I need to approve a token first?"],
  },
  {
    id: "aave", name: "Aave", color: "#B6509E", logo: "/protocols/aave.png" as string | undefined,
    blurb: "Aave V4's Arc markets. Supply and borrow USDC, EURC, cirBTC.",
    suggestions: ["Why did my deposit fail?", "What's in my wallet?", "What was my last transaction?"],
  },
  {
    id: "morpho", name: "Morpho", color: "#2470FF", logo: "/protocols/morpho.png" as string | undefined,
    blurb: "Arc's largest lending protocol, with curated USDC vaults.",
    suggestions: ["Why did my transaction fail?", "What's in my wallet?", "What have I done on Arc recently?"],
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
  toolCall?: string | null
}

type Eip1193 = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown> }

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

const EVM_ADDR = /^0x[0-9a-fA-F]{40}$/

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentAvatar() {
  return (
    <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 shrink-0 mt-0.5 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/txid-icon-64.png" alt="TxID" className="w-full h-full object-cover" />
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

export default function ArcCheckPage() {
  const [step, setStep] = useState<"connect" | "chat">("connect")
  const [protocolId, setProtocolId] = useState("wallet")
  const [wallet, setWallet] = useState("")
  const [manualAddress, setManualAddress] = useState("")
  const [connectError, setConnectError] = useState("")
  const [limitReached, setLimitReached] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loadingTrader, setLoadingTrader] = useState(false)
  const [loading, setLoading] = useState(false)
  // ?key=pk_… lets us smoke-test against a different demo project before the
  // env var is set. Read once on mount (client component, no SSR window).
  const [keyOverride, setKeyOverride] = useState("")

  const sessionId = useRef(crypto.randomUUID())
  const messagesEnd = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const protocol = PROTOCOLS.find(p => p.id === protocolId) ?? PROTOCOLS[0]
  const demoKey = keyOverride || ARC_DEMO_KEY

  const themeStyle = accentVars(ARC_BLUE) as React.CSSProperties
  const ctaText = readableText(ARC_BLUE)

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
          chainId: ARC_CHAIN_ID,
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

  function enterChat(addr: string, note?: string) {
    setMessages([{
      role: "assistant",
      content: `Hi! I'm ${protocol.id === "wallet" ? "TxID on Arc (a live demo)" : `${protocol.name} support on Arc (a live TxID demo)`}. I can see the wallet ${shortAddr(addr)}.${note ? `\n\n${note}` : ""}\n\nI read Arc directly: why a transaction failed, what this wallet has sent recently, and whether it has the USDC Arc charges for fees. Pick a suggestion below, or paste a transaction hash.`,
    }])
    setStep("chat")
  }

  // ── Wallet connect (any injected EVM wallet, switched to Arc) ────────────

  async function connectWallet() {
    setConnectError("")
    const eth = (window as unknown as { ethereum?: Eip1193 }).ethereum
    if (!eth) {
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        window.location.href = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`
        return
      }
      setConnectError("No wallet detected. Install MetaMask or Rabby, or paste an address below.")
      return
    }
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[]
      const addr = accounts?.[0]
      if (!addr) throw new Error("no account")
      // Ask to switch to Arc, adding it first if the wallet has never seen it.
      // Declining is fine: the demo reads Arc for this address either way.
      try {
        await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_ID }] })
      } catch (e) {
        if ((e as { code?: number })?.code === 4902) {
          await eth.request({ method: "wallet_addEthereumChain", params: [ARC_CHAIN_PARAMS] }).catch(() => {})
        }
      }
      setWallet(addr)
      enterChat(addr)
    } catch {
      setConnectError("Wallet connection was rejected.")
    }
  }

  // Most people trying this have no Arc history, so a clean wallet makes the
  // demo land flat. This picks a real everyday wallet whose most recent Arc
  // transaction just failed, so "why did my last transaction fail?" has a
  // real answer from the chain.
  async function useLiveWallet() {
    setConnectError("")
    setLoadingTrader(true)
    try {
      const r = await fetch("/api/arc/sample-wallet")
      const j = (await r.json()) as { address?: string; failed?: boolean; error?: string }
      if (!r.ok || !j.address) {
        setConnectError(j.error ?? "Could not find one just now. Paste an address instead.")
        return
      }
      // The chat reads `wallet`, so the live wallet has to be stored, not only greeted.
      setWallet(j.address)
      enterChat(j.address, j.failed
        ? "This is a real Arc wallet, picked because its most recent transaction just failed. Ask why."
        : "This is a real Arc wallet that was active in the last few hours. Ask what it has been doing.")
    } catch {
      setConnectError("Could not reach Arc. Paste an address instead.")
    } finally {
      setLoadingTrader(false)
    }
  }

  function goWithManual() {
    setConnectError("")
    const addr = manualAddress.trim()
    if (!EVM_ADDR.test(addr)) {
      setConnectError("Enter a valid Arc address (0x followed by 40 characters)")
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
                <img src="/chains/Arc.jpg" alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                Live on Arc mainnet · A few free questions · No sign-up
              </span>
              <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
                Test-drive TxID on Arc
              </h1>
              <p className="text-muted text-base leading-relaxed">
                Connect a wallet and watch TxID read Arc live: why a transaction failed, what the wallet has sent, and whether it has the USDC Arc charges for fees. No wallet on Arc? Use a live one.
              </p>
            </div>

            <div className="rounded-2xl border border-[#1e1e3a] bg-[#0f0f1a] p-5 sm:p-8 space-y-6">

              {/* Protocol picker */}
              <div>
                <p className="text-xs font-mono text-muted mb-2.5">1 · Pick what to ask about</p>
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
                  onClick={connectWallet}
                  style={{ color: ctaText }}
                  className="w-full flex items-center justify-center gap-3 rounded-xl bg-accent hover:bg-accent/90 active:bg-accent/80 font-semibold py-3.5 transition-colors"
                >
                  <Wallet className="w-4 h-4" />
                  Connect wallet
                </button>

                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[#1e1e3a]" />
                  <span className="text-xs text-muted font-mono">or paste an address</span>
                  <div className="flex-1 h-px bg-[#1e1e3a]" />
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Arc address (0x…)"
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

                <button
                  onClick={useLiveWallet}
                  disabled={loadingTrader}
                  className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#1e1e3a] bg-transparent text-muted hover:text-white hover:border-accent/60 text-xs py-2.5 transition-colors disabled:opacity-50"
                >
                  <Users className="w-3.5 h-3.5" />
                  {loadingTrader ? "Finding a live Arc wallet…" : "No Arc history? Use a live Arc wallet"}
                </button>
              </div>

              {connectError && (
                <div className="flex items-start gap-2 rounded-lg bg-red-950/40 border border-red-900/40 px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{connectError}</p>
                </div>
              )}

              {!demoKey && (
                <p className="text-center text-xs text-muted/60">
                  Live AI not configured. Set <code className="font-mono">NEXT_PUBLIC_ARC_DEMO_WIDGET_KEY</code> to enable.
                </p>
              )}
            </div>

            <p className="text-center text-xs text-muted/50 mt-8">
              Reads on-chain data only · Private keys never required · Powered by{" "}
              <span className="text-accent font-mono">TxID</span>
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
                <img src="/chains/Arc.jpg" alt="" className="w-3.5 h-3.5 rounded-sm object-cover" />
                <span className="text-xs text-muted">Arc</span>
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
                    href="mailto:team@txid.support?subject=TxID on Arc"
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
                    placeholder="Ask about this wallet on Arc, or paste a transaction hash…"
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
              <p className="text-sm font-semibold text-white">Building on Arc?</p>
              <p className="text-xs text-muted mt-0.5">This is a live test. Want your users to get the same support? We&apos;ll set you up personally.</p>
            </div>
            <a
              href="mailto:team@txid.support?subject=TxID on Arc"
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
