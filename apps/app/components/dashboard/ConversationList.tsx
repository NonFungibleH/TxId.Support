"use client"

import { useState, useEffect, useRef } from "react"
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Wallet, Download, Globe, MessageSquare, Bot, Ticket, Loader2, CheckCircle2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ConversationWithMessages } from "@/app/dashboard/conversations/page"

const CHAIN_NAMES: Record<string, string> = {
  "1":     "Ethereum",
  "8453":  "Base",
  "42161": "Arbitrum",
  "137":   "Polygon",
  "10":    "Optimism",
  "56":    "BNB Chain",
  "43114": "Avalanche",
  "250":   "Fantom",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function SessionBadge({ walletAddress }: { walletAddress: string | null }) {
  if (!walletAddress) return <span className="text-xs text-muted-foreground">Anonymous</span>
  return (
    <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
      <Wallet className="size-3" />
      {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
    </span>
  )
}

function FeedbackIcon({ feedback }: { feedback: number }) {
  if (feedback === 1) return <ThumbsUp className="size-3 text-green-500" />
  if (feedback === -1) return <ThumbsDown className="size-3 text-red-500" />
  return null
}

type TicketStatus = "idle" | "loading" | "done" | "error"

export function ConversationList({ conversations }: { conversations: ConversationWithMessages[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<Record<string, string>>({})
  const [summaryLoading, setSummaryLoading] = useState<Record<string, boolean>>({})
  const [ticketStatus, setTicketStatus] = useState<Record<string, TicketStatus>>({})
  const [ticketRefs, setTicketRefs] = useState<Record<string, string>>({})
  const fetchedSummaries = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!expanded) return
    if (fetchedSummaries.current.has(expanded)) return
    fetchedSummaries.current.add(expanded)

    setSummaryLoading(prev => ({ ...prev, [expanded]: true }))
    fetch(`/api/conversations/${expanded}/summary`)
      .then(r => r.json())
      .then(data => {
        setSummaries(prev => ({ ...prev, [expanded]: data.summary ?? "" }))
        setSummaryLoading(prev => ({ ...prev, [expanded]: false }))
      })
      .catch(() => setSummaryLoading(prev => ({ ...prev, [expanded]: false })))
  }, [expanded])

  async function raiseTicket(convId: string) {
    setTicketStatus(prev => ({ ...prev, [convId]: "loading" }))
    try {
      const res = await fetch(`/api/conversations/${convId}/ticket`, { method: "POST" })
      if (res.ok) {
        const data = await res.json()
        setTicketRefs(prev => ({ ...prev, [convId]: data.ref }))
        setTicketStatus(prev => ({ ...prev, [convId]: "done" }))
      } else {
        setTicketStatus(prev => ({ ...prev, [convId]: "error" }))
      }
    } catch {
      setTicketStatus(prev => ({ ...prev, [convId]: "error" }))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a
          href="/api/conversations/export"
          download="conversations.csv"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-transparent px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Download className="size-3.5" />
          Export CSV
        </a>
      </div>
      <div className="space-y-2">
      {conversations.map((conv) => {
        const isOpen = expanded === conv.id
        const msgCount = conv.messages.length
        const userMsgCount = conv.messages.filter(m => m.role === "user").length
        const botMsgCount = conv.messages.filter(m => m.role === "assistant").length
        const preview = conv.messages.find((m) => m.role === "user")?.content ?? ""
        const hasNegative = conv.messages.some((m) => m.feedback === -1)
        const chainName = conv.chain_id ? (CHAIN_NAMES[conv.chain_id] ?? `Chain ${conv.chain_id}`) : null

        const lastMsg = conv.messages[conv.messages.length - 1]
        const outcome = lastMsg?.role === "user" ? "dropped" : "ended"

        const tStatus = ticketStatus[conv.id] ?? "idle"
        const tRef = ticketRefs[conv.id]
        const summary = summaries[conv.id]
        const loadingSummary = summaryLoading[conv.id]

        return (
          <div
            key={conv.id}
            className="rounded-lg border border-border bg-card overflow-hidden"
          >
            <button
              onClick={() => setExpanded(isOpen ? null : conv.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  <SessionBadge walletAddress={conv.wallet_address} />
                  {chainName && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="size-3" />
                      {chainName}
                    </span>
                  )}
                  {outcome === "dropped" && (
                    <Badge className="text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-amber-500/10 text-amber-400 border-amber-500/20">
                      Dropped off
                    </Badge>
                  )}
                  {hasNegative && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 leading-none shrink-0">Low satisfaction</Badge>
                  )}
                </div>
                <p className="text-sm truncate text-muted-foreground">{preview || "No messages"}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground">{msgCount} msg{msgCount !== 1 ? "s" : ""}</span>
                <span className="text-xs text-muted-foreground">{timeAgo(conv.created_at)}</span>
                {isOpen ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-border bg-muted/20">
                {/* Session metadata */}
                <div className="px-4 py-3 border-b border-border/60 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Wallet</p>
                    {conv.wallet_address
                      ? <p className="text-xs font-mono text-foreground break-all">{conv.wallet_address}</p>
                      : <p className="text-xs text-muted-foreground">Anonymous</p>}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Network</p>
                    <p className="text-xs text-foreground">{chainName ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Started</p>
                    <p className="text-xs text-foreground">{formatDate(conv.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Messages</p>
                    <p className="text-xs text-foreground flex items-center gap-2">
                      <span className="flex items-center gap-1"><MessageSquare className="size-3" />{userMsgCount} user</span>
                      <span className="flex items-center gap-1"><Bot className="size-3" />{botMsgCount} bot</span>
                    </p>
                  </div>
                </div>

                {/* AI summary */}
                <div className="px-4 pt-3 pb-2">
                  {loadingSummary ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Generating summary…
                    </div>
                  ) : summary ? (
                    <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-foreground/80 italic">
                      {summary}
                    </div>
                  ) : null}
                </div>

                {/* Transcript */}
                <div className="px-4 pb-3 pt-1 space-y-2.5">
                  {conv.messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary mt-0.5">AI</div>
                      )}
                      <div
                        className={`max-w-[80%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {msg.role === "assistant" && msg.feedback !== 0 && (
                        <div className="mt-1 shrink-0">
                          <FeedbackIcon feedback={msg.feedback} />
                        </div>
                      )}
                      {msg.role === "user" && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold mt-0.5">U</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Raise ticket */}
                <div className="px-4 pb-4 flex items-center justify-end gap-3">
                  {tStatus === "done" ? (
                    <span className="flex items-center gap-1.5 text-xs text-green-400">
                      <CheckCircle2 className="size-3.5" />
                      {tRef} raised —{" "}
                      <a href="/dashboard/tickets" className="underline hover:no-underline">
                        View tickets
                      </a>
                    </span>
                  ) : tStatus === "error" ? (
                    <span className="text-xs text-destructive">Failed to create ticket.</span>
                  ) : (
                    <button
                      onClick={() => raiseTicket(conv.id)}
                      disabled={tStatus === "loading"}
                      className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {tStatus === "loading"
                        ? <><Loader2 className="size-3 animate-spin" /> Creating…</>
                        : <><Ticket className="size-3" /> Raise ticket</>
                      }
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
      </div>
    </div>
  )
}
