"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { ArrowRight, Wallet, RotateCcw, Send, AlertCircle, CheckCircle2, ChevronDown } from "lucide-react"
import { APP_URL } from "@/lib/config"
import { clsx } from "clsx"

// ── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support"
const DEMO_KEY = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY ?? ""

const CHAINS = [
  { id: "1",     name: "Ethereum",  logo: "/chains/Ethereum.png" },
  { id: "8453",  name: "Base",      logo: "/chains/Base.png"     },
  { id: "42161", name: "Arbitrum",  logo: "/chains/Arbitrum.png" },
  { id: "137",   name: "Polygon",   logo: "/chains/Polygon.png"  },
  { id: "10",    name: "Optimism",  logo: "/chains/Optimism.png" },
  { id: "56",    name: "BNB Chain", logo: "/chains/BNB.png"      },
]

const STARTER_PROMPTS = [
  "Why did my last transaction fail?",
  "Where are my tokens?",
  "Am I on the right network?",
  "What's wrong with my wallet?",
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user"
  return (
    <div className={clsx("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[10px] text-accent font-mono font-bold">AI</span>
        </div>
      )}
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
          isUser
            ? "bg-accent text-white rounded-br-sm"
            : "bg-[#0f0f1a] border border-[#1e1e3a] text-[#94a3b8] rounded-bl-sm"
        )}
      >
        {msg.content}
        {msg.streaming && (
          <span className="inline-block w-1 h-3.5 bg-accent/60 ml-0.5 animate-pulse align-middle" />
        )}
      </div>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex gap-3 justify-start">
      <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
        <span className="text-[10px] text-accent font-mono font-bold">AI</span>
      </div>
      <div className="bg-[#0f0f1a] border border-[#1e1e3a] rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: "0ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: "150ms" }} />
          <span className="w-1.5 h-1.5 rounded-full bg-accent/50 animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  )
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
  const hasGreeted = useRef(false)

  const chain = CHAINS.find(c => c.id === chainId) ?? CHAINS[0]

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // ── Auto-greeting when wallet connects ──────────────────────────────────────

  const sendToAI = useCallback(async (userText: string) => {
    const userMsg: Message = { role: "user", content: userText }
    setMessages(prev => [...prev, userMsg, { role: "assistant", content: "", streaming: true }])
    setLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: DEMO_KEY,
          sessionId: sessionId.current,
          messages: [{ role: "user", content: userText }],
          walletAddress: wallet || manualAddress,
          chainId,
        }),
      })

      if (!res.ok || !res.body) throw new Error("API error")

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
            const parsed = JSON.parse(raw)
            if (parsed.token) {
              assistantText += parsed.token
              setMessages(prev => {
                const next = [...prev]
                next[next.length - 1] = { role: "assistant", content: assistantText, streaming: true }
                return next
              })
            }
          } catch { /* partial chunk */ }
        }
      }

      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: "assistant", content: assistantText, streaming: false }
        return next
      })
    } catch {
      setMessages(prev => {
        const next = [...prev]
        next[next.length - 1] = { role: "assistant", content: "Something went wrong connecting to the AI. Please try again.", streaming: false }
        return next
      })
    } finally {
      setLoading(false)
    }
  }, [wallet, manualAddress, chainId])

  useEffect(() => {
    if (step === "chat" && !hasGreeted.current && DEMO_KEY) {
      hasGreeted.current = true
      const addr = wallet || manualAddress
      const chainName = chain.name
      sendToAI(
        `Hi! My wallet address is ${addr} and I'm on ${chainName}. Please check my recent transactions and let me know if there's anything I should know about — failed txs, stuck funds, anything unusual.`
      )
    }
  }, [step, wallet, manualAddress, chain.name, sendToAI])

  // ── Wallet connect ──────────────────────────────────────────────────────────

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
      setStep("chat")
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
    setStep("chat")
  }

  // ── Send message ────────────────────────────────────────────────────────────

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
    hasGreeted.current = false
  }

  // ── Connect step ────────────────────────────────────────────────────────────

  if (step === "connect") {
    return (
      <>
        <Navbar />
        <main className="min-h-screen pt-28 pb-24">
          <div className="max-w-xl mx-auto px-6">

            {/* Hero */}
            <div className="text-center mb-12">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 border border-accent/20 px-3 py-1 text-xs font-mono text-accent mb-5">
                <CheckCircle2 className="w-3 h-3" /> Free · No sign-up · No private keys
              </span>
              <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
                Diagnose any crypto transaction
              </h1>
              <p className="text-muted text-base leading-relaxed">
                Connect your wallet and ask the AI anything — why a transaction failed, where your tokens went, what a revert reason means.
              </p>
            </div>

            {/* Connect card */}
            <div className="rounded-2xl border border-[#1e1e3a] bg-[#0f0f1a] p-8 space-y-6">

              {/* MetaMask button */}
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

              {/* Manual address */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="0x1a2b3c4d…"
                  value={manualAddress}
                  onChange={e => { setManualAddress(e.target.value); setConnectError("") }}
                  onKeyDown={e => e.key === "Enter" && goWithManual()}
                  className="w-full bg-[#07070d] border border-[#1e1e3a] rounded-xl px-4 py-3 text-white font-mono text-sm placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
                />

                {/* Chain selector */}
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

            {/* Starter prompt chips */}
            <div className="mt-8">
              <p className="text-xs text-muted text-center mb-3 font-mono">Common questions</p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTER_PROMPTS.map(p => (
                  <span key={p} className="rounded-full border border-[#1e1e3a] px-3 py-1.5 text-xs text-muted">
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Trust line */}
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

  // ── Chat step ───────────────────────────────────────────────────────────────

  const displayAddr = wallet || manualAddress

  return (
    <>
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

            {messages.length === 0 && loading && <TypingIndicator />}

            {messages.map((msg, i) => (
              <ChatMessage key={i} msg={msg} />
            ))}

            {loading && !messages[messages.length - 1]?.streaming && (
              <TypingIndicator />
            )}

            {/* Starter prompts after greeting */}
            {!loading && messages.length >= 2 && messages.length < 4 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {STARTER_PROMPTS.map(p => (
                  <button
                    key={p}
                    onClick={() => handleSend(p)}
                    className="rounded-full border border-[#1e1e3a] hover:border-accent/40 hover:bg-accent/5 px-3 py-1.5 text-xs text-muted hover:text-white transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}

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
                placeholder="Ask anything about your wallet…"
                disabled={loading}
                className="flex-1 bg-transparent resize-none text-sm text-white placeholder:text-muted focus:outline-none leading-relaxed max-h-40 disabled:opacity-50"
                style={{ scrollbarWidth: "none" }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-accent text-white p-2 hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
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
