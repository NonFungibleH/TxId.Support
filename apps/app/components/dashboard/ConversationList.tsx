"use client"

import { useState, useEffect, useRef } from "react"
import { sourceOf, SOURCE_LABEL, type ConversationSource } from "@/lib/conversation-source"
import type { EvidenceSource } from "@txid/ai"
import { useRouter } from "next/navigation"
import { ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Wallet, Download, Globe, MessageSquare, Bot, Ticket, Loader2, CheckCircle2, ShieldCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import type { ConversationWithMessages } from "@/app/dashboard/conversations/page"
import { summarizeStaleConversations, type ConvSummary } from "@/lib/actions/summarize"
import { conversationOutcome, OUTCOME_META, type Outcome } from "@/lib/conversation-outcome"
import { findingKindOf } from "@/lib/finding-openers"

/** Colour per outcome. "capped" is amber, not red: the user was handed to a
 *  human, so it is a limit to review rather than a failure to fix. */
const OUTCOME_BADGE: Record<Outcome, string> = {
  answered:    "",
  in_progress: "text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-muted text-muted-foreground border-border",
  capped:      "text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-amber-500/10 text-amber-500 border-amber-500/20",
  unanswered:  "text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-red-500/10 text-red-400 border-red-500/20",
  unhelpful:   "text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-orange-500/10 text-orange-400 border-orange-500/20",
}

// AI category tags for the scannable list. Colours picked for at-a-glance triage.
const CATEGORY_STYLE: Record<string, string> = {
  "failed-tx":       "bg-red-500/10 text-red-400 border-red-500/20",
  "bug-report":      "bg-orange-500/10 text-orange-400 border-orange-500/20",
  "how-to":          "bg-sky-500/10 text-sky-400 border-sky-500/20",
  "feature-request": "bg-violet-500/10 text-violet-400 border-violet-500/20",
  "account":         "bg-teal-500/10 text-teal-400 border-teal-500/20",
  "other":           "bg-muted text-muted-foreground border-border",
}
const CATEGORY_LABEL: Record<string, string> = {
  "failed-tx": "Failed tx", "bug-report": "Bug", "how-to": "How-to",
  "feature-request": "Feature req", "account": "Account", "other": "Other",
}
const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-green-500", neutral: "bg-muted-foreground/40", negative: "bg-red-500",
}

const CHAIN_NAMES: Record<string, string> = {
  "1":     "Ethereum",   "0x1":      "Ethereum",
  "8453":  "Base",       "0x2105":   "Base",
  "42161": "Arbitrum",   "0xa4b1":   "Arbitrum",
  "137":   "Polygon",    "0x89":     "Polygon",
  "10":    "Optimism",   "0xa":      "Optimism",
  "56":    "BNB Chain",  "0x38":     "BNB Chain",
  "43114": "Avalanche",  "0xa86a":   "Avalanche",
  "42793": "Etherlink",  "0xa729":   "Etherlink",
  "250":   "Fantom",
  "aptos": "Aptos",
  "0xaa36a7": "Sepolia (Testnet)",
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

function SessionBadge({ walletAddress, onClick }: { walletAddress: string | null; onClick?: (e: React.MouseEvent) => void }) {
  if (!walletAddress) return <span className="text-xs text-muted-foreground">Anonymous</span>
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick?.(e as unknown as React.MouseEvent)}
      className="flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary hover:underline underline-offset-2 cursor-pointer transition-colors"
      title="Filter by this wallet"
    >
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

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-mono text-[11px] text-foreground break-all">{value}</span>
    </div>
  )
}

/**
 * What an answer rested on. This is the part a compliance reviewer opens: the
 * transcript says what was said, the record says under what conditions and
 * whether it can be reproduced.
 */
/** The path a URL points at, for display: the host is always the protocol's own site. */
function pagePath(u: string): string {
  try { return new URL(u).pathname || "/" } catch { return u }
}

function EvidenceBadge({ evidence }: { evidence: NonNullable<ConversationWithMessages["messages"][number]["evidence"]> }) {
  const [open, setOpen] = useState(false)
  const chain = evidence.chain
  const req = evidence.request
  const inv = evidence.investigation
  const prices = (evidence as { pricesAtRead?: Record<string, string> }).pricesAtRead
  const sources = ((evidence as { sources?: EvidenceSource[] }).sources ?? [])
  const grounding = (evidence as { grounding?: "verified" | "documented" | "ungrounded" }).grounding
  const unverified = (evidence as { unverifiedNumbers?: string[] }).unverifiedNumbers ?? []

  // FIXED positioning, measured from the trigger. Absolute placement kept it
  // inside the page's scroll flow, so on the last message of a transcript the
  // panel ran past the fold and the record was unreadable exactly when it
  // mattered. Fixed takes it out of the flow entirely; the anchor maths flips
  // it above the badge when there is no room below, and clamps it on screen.
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  const place = () => {
    const el = btnRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const W = 352, H = Math.min(window.innerHeight * 0.7, 440), gap = 8
    const below = window.innerHeight - r.bottom
    const top = below >= H + gap ? r.bottom + gap : Math.max(gap, r.top - H - gap)
    const left = Math.min(Math.max(gap, r.right - W), window.innerWidth - W - gap)
    setPos({ top, left })
  }

  useEffect(() => {
    if (!open) return
    place()
    const onChange = () => setOpen(false) // scrolling away should not drag a fixed panel along
    window.addEventListener("scroll", onChange, true)
    window.addEventListener("resize", onChange)
    return () => {
      window.removeEventListener("scroll", onChange, true)
      window.removeEventListener("resize", onChange)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <div className="mt-1 shrink-0">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        title="What this answer rested on"
        className="flex h-5 w-5 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
      >
        <ShieldCheck
          className={`h-3 w-3 ${grounding === "ungrounded" ? "text-amber-600" : ""}`}
        />
      </button>
      {open && pos && (
        <>
          {/* Click-away, and it keeps the panel dismissible on touch. */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
        <div
          className="fixed z-40 max-h-[70vh] w-[22rem] space-y-2.5 overflow-y-auto rounded-xl border border-border bg-background p-3 shadow-lg"
          style={{ top: pos.top, left: pos.left }}
        >
          <p className="text-[11px] font-semibold text-foreground">Case record</p>

          {chain && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Chain state</p>
              <Field label="Chain" value={chain.chainId} />
              {chain.ledgerVersion && <Field label="Ledger" value={chain.ledgerVersion} />}
              {chain.blockNumber && <Field label="Block" value={chain.blockNumber} />}
              <Field label="Read at" value={new Date(chain.readAt).toLocaleString()} />
            </div>
          )}

          {prices && Object.keys(prices).length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Prices quoted</p>
              {Object.entries(prices).slice(0, 6).map(([k, v]) => <Field key={k} label={k} value={v} />)}
            </div>
          )}

          {inv?.toolsUsed && inv.toolsUsed.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Checked</p>
              <p className="font-mono text-[11px] text-foreground">{inv.toolsUsed.join(", ")}</p>
            </div>
          )}

          {inv?.failedLookups && inv.failedLookups.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">Failed lookups</p>
              {inv.failedLookups.slice(0, 3).map(fl => (
                <p key={fl} className="text-[11px] text-muted-foreground">{fl}</p>
              ))}
            </div>
          )}

          {grounding && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Basis</p>
              <p className="text-[11px] leading-relaxed">
                {grounding === "verified" && "Read live from the chain and verified at the time."}
                {grounding === "documented" && "Answered from the protocol's own documentation."}
                {grounding === "ungrounded" && (
                  <span className="text-amber-600">
                    No live read and no documentation match. Answered from general knowledge, so
                    nothing here can be checked against a source.
                  </span>
                )}
              </p>
            </div>
          )}

          {unverified.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
                Figures with no source
              </p>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                These appeared in the answer but trace to neither a live reading nor the
                documentation, so the assistant produced them. The user was told.
              </p>
              <p className="font-mono text-[11px] text-amber-600">{unverified.join(", ")}</p>
            </div>
          )}

          {sources.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                Answer generated from
              </p>
              {sources.map((s, i) => (
                <p key={i} className="text-[11px] leading-relaxed text-muted-foreground">
                  {s.kind === "documentation" && (
                    <>
                      <span className="text-foreground">Documentation</span>{" "}
                      {s.version ? <span className="font-mono">v{s.version}</span> : "(version not tracked)"}
                      <br />
                      <span className="break-all">{s.url}</span>
                    </>
                  )}
                  {s.kind === "contract" && (
                    <>
                      <span className="text-foreground">Contract</span>{" "}
                      <span className="break-all font-mono">{s.address}</span>
                      {s.fn && <> · {s.fn}</>}
                    </>
                  )}
                  {s.kind === "transaction" && (
                    <>
                      <span className="text-foreground">Transaction</span>{" "}
                      {/* Who supplied it decides what it proves. */}
                      <span className={s.origin === "user_supplied" ? "text-amber-600" : ""}>
                        {s.origin === "user_supplied" ? "(pasted by user)" : "(looked up)"}
                      </span>
                      <br />
                      <span className="break-all font-mono">{s.hash}</span>
                    </>
                  )}
                  {s.kind === "price" && (
                    <>
                      <span className="text-foreground">Price</span> {s.asset}:{" "}
                      <span className="font-mono">{s.value}</span>
                      {s.via && <> · via {s.via}</>}
                    </>
                  )}
                  {s.kind === "position" && (
                    <>
                      <span className="text-foreground">Position</span>{" "}
                      {s.protocol ? `${s.protocol} ` : ""}
                      <span className="break-all font-mono">{s.account}</span>
                    </>
                  )}
                  {s.kind === "parameter" && (
                    <>
                      <span className="text-foreground">Parameter</span> {s.name}:{" "}
                      <span className="font-mono">{s.value}</span>
                    </>
                  )}
                </p>
              ))}
            </div>
          )}

          {req && (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Context</p>
              {req.country && <Field label="Country" value={req.country} />}
              {req.deviceType && <Field label="Device" value={[req.deviceType, req.platform, req.browser].filter(Boolean).join(" · ")} />}
              {req.surface && <Field label="Surface" value={req.surface} />}
              {req.language && <Field label="Language" value={req.language} />}
              {(req as { pageUrl?: string }).pageUrl && (
                <Field label="Page" value={pagePath((req as { pageUrl?: string }).pageUrl!)} />
              )}
              {(req as { viewport?: string }).viewport && (
                <Field label="Viewport" value={(req as { viewport?: string }).viewport!} />
              )}
            </div>
          )}

          <div className="space-y-1 border-t border-border pt-2">
            {evidence.model?.name && <Field label="Model" value={evidence.model.name} />}
            {typeof evidence.latencyMs === "number" && <Field label="Latency" value={`${evidence.latencyMs} ms`} />}
            {evidence.answer && <Field label="SHA-256" value={`${evidence.answer.sha256.slice(0, 24)}…`} />}
          </div>

          <p className="text-[10px] leading-relaxed text-muted-foreground">
            No IP address is stored. Country is resolved at the edge and the address discarded.
          </p>
        </div>
        </>
      )}
    </div>
  )
}

/** Other conversations from the same user. See the page for how it is derived. */
type RelatedInfo = {
  key: string
  kind: "wallet" | "browser"
  total: number
  others: { id: string; created_at: string }[]
}

export function ConversationList({
  conversations,
  existingTickets = {},
  related = {},
  sessionCap,
}: {
  conversations: ConversationWithMessages[]
  existingTickets?: Record<string, { ref: string; status: string }>
  related?: Record<string, RelatedInfo>
  /** This project's per-conversation user-message cap, so a capped
   *  conversation can be told apart from one that simply ended. */
  sessionCap?: number
}) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [ticketStatus, setTicketStatus] = useState<Record<string, TicketStatus>>(() =>
    Object.fromEntries(Object.keys(existingTickets).map(id => [id, "done"]))
  )
  const [ticketErrors, setTicketErrors] = useState<Record<string, string>>({})
  const [ticketRefs, setTicketRefs] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(existingTickets).map(([id, t]) => [id, t.ref]))
  )

  // Persisted list-level summaries (one-line + category + sentiment), merged
  // over the server-rendered rows as stale ones get summarised on mount. This
  // replaces the old on-expand /api/conversations/[id]/summary fetch - one
  // cached, categorised, cost-tracked summary system instead of two.
  const [tags, setTags] = useState<Record<string, ConvSummary>>({})
  const [catFilter, setCatFilter] = useState<string>("all")
  const [srcFilter, setSrcFilter] = useState<ConversationSource | "all">("all")
  const staleTriggered = useRef(false)
  useEffect(() => {
    if (staleTriggered.current) return
    staleTriggered.current = true
    const hasStale = conversations.some(c => !c.summary)
    if (!hasStale) return
    void summarizeStaleConversations(8)
      .then(fresh => {
        if (fresh.length) setTags(prev => ({ ...prev, ...Object.fromEntries(fresh.map(f => [f.id, f])) }))
      })
      .catch(() => { /* non-fatal - rows fall back to first message */ })
  }, [conversations])

  async function raiseTicket(convId: string) {
    setTicketStatus(prev => ({ ...prev, [convId]: "loading" }))
    try {
      const res = await fetch(`/api/conversations/${convId}/ticket`, { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setTicketRefs(prev => ({ ...prev, [convId]: data.ref }))
        setTicketStatus(prev => ({ ...prev, [convId]: "done" }))
      } else {
        // Show why. "Failed to create ticket" with no reason is not actionable.
        setTicketErrors(prev => ({
          ...prev,
          [convId]: [data.error, data.detail, data.code].filter(Boolean).join(" · ") || `HTTP ${res.status}`,
        }))
        setTicketStatus(prev => ({ ...prev, [convId]: "error" }))
      }
    } catch (err) {
      setTicketErrors(prev => ({
        ...prev,
        [convId]: err instanceof Error ? err.message : "Request failed",
      }))
      setTicketStatus(prev => ({ ...prev, [convId]: "error" }))
    }
  }

  const effectiveCat = (c: ConversationWithMessages) => tags[c.id]?.category ?? c.category ?? null
  const presentCats = Array.from(new Set(conversations.map(effectiveCat).filter(Boolean))) as string[]
  // Only offer a source filter when more than one is actually in use: a lone
  // "Widget" button is chrome that teaches the reader nothing.
  const presentSources = Array.from(new Set(conversations.map(c => sourceOf(c.session_id)))) as ConversationSource[]
  const visible = conversations
    .filter(c => catFilter === "all" || effectiveCat(c) === catFilter)
    .filter(c => srcFilter === "all" || sourceOf(c.session_id) === srcFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {presentCats.length > 0 ? (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCatFilter("all")}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${catFilter === "all" ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              All
            </button>
            {presentCats.map(cat => (
              <button
                key={cat}
                onClick={() => setCatFilter(cat)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${catFilter === cat ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {CATEGORY_LABEL[cat] ?? cat}
              </button>
            ))}
          </div>
        ) : <span />}

        {presentSources.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Source</span>
            {(["all", ...presentSources] as const).map(s => (
              <button
                key={s}
                onClick={() => setSrcFilter(s as ConversationSource | "all")}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${srcFilter === s ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
              >
                {s === "all" ? "All" : SOURCE_LABEL[s as ConversationSource]}
              </button>
            ))}
          </div>
        )}

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
      {visible.map((conv) => {
        const isOpen = expanded === conv.id
        const msgCount = conv.messages.length
        const userMsgCount = conv.messages.filter(m => m.role === "user").length
        const botMsgCount = conv.messages.filter(m => m.role === "assistant").length
        const preview = conv.messages.find((m) => m.role === "user")?.content ?? ""
        const hasNegative = conv.messages.some((m) => m.feedback === -1)
        const chainName = conv.chain_id ? (CHAIN_NAMES[conv.chain_id] ?? `Chain ${conv.chain_id}`) : null

        // A conversation whose LAST message is the user's is not one the user
        // wandered away from: persistMessages writes the question and the answer
        // together, so a user-final conversation is one where the answer never
        // generated. That is our failure, and calling it "dropped off" both
        // blamed the user and hid it from the gaps view.
        //
        // The exception is a conversation still in flight, where the answer is
        // simply not written yet, so recent ones are left unlabelled.
        const outcome = conversationOutcome({
          messages: conv.messages,
          ...(sessionCap ? { sessionCap } : {}),
        })
        const outcomeMeta = OUTCOME_META[outcome]
        // A bug or feedback thread still belongs in Conversations, since it is
        // a conversation and the record has to be complete. Labelling it is
        // what stops the two views feeling like duplicates of each other.
        const findingKind = findingKindOf(conv.messages)

        const tStatus = ticketStatus[conv.id] ?? "idle"
        const tRef = ticketRefs[conv.id]

        // Persisted list-level tag: freshly summarised (state) or server-rendered.
        const tag: ConvSummary | null =
          tags[conv.id] ??
          (conv.category ? { id: conv.id, summary: conv.summary ?? "", category: conv.category, sentiment: conv.sentiment ?? "neutral" } : null)

        return (
          <div
            key={conv.id}
            // overflow-hidden only while COLLAPSED: it exists for the rounded
            // corners, but on an expanded card it clipped the Case record
            // popover mid-sentence at the card edge.
            className={`rounded-lg border border-border bg-card ${isOpen ? "" : "overflow-hidden"}`}
          >
            <button
              onClick={() => setExpanded(isOpen ? null : conv.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                  {tag && (
                    <Badge className={`text-[10px] px-1.5 py-0.5 leading-none shrink-0 ${CATEGORY_STYLE[tag.category] ?? CATEGORY_STYLE.other}`}>
                      {CATEGORY_LABEL[tag.category] ?? "Other"}
                    </Badge>
                  )}
                  <SessionBadge
                    walletAddress={conv.wallet_address}
                    onClick={conv.wallet_address ? (e) => {
                      e.stopPropagation()
                      router.push(`/dashboard/conversations?wallet=${encodeURIComponent(conv.wallet_address!)}`)
                    } : undefined}
                  />
                  {chainName && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Globe className="size-3" />
                      {chainName}
                    </span>
                  )}
                  {/* SAME USER, EARLIER. A wallet is an identity the person
                      proved by connecting it, so it links across devices; a
                      visitor id only says same browser and is gone the moment
                      site data is cleared. The two are labelled differently
                      because overstating the second would have a support agent
                      reading one person's history as another's. */}
                  {related[conv.id] && (
                    <Badge
                      title={
                        related[conv.id]!.kind === "wallet"
                          ? `Same wallet as ${related[conv.id]!.total - 1} other conversation${related[conv.id]!.total === 2 ? "" : "s"}. Click to see them all.`
                          : `Same browser as ${related[conv.id]!.total - 1} other conversation${related[conv.id]!.total === 2 ? "" : "s"}. Not proof of the same person: a shared or reset browser looks identical.`
                      }
                      onClick={(e) => {
                        e.stopPropagation()
                        if (related[conv.id]!.kind === "wallet") {
                          router.push(`/dashboard/conversations?wallet=${encodeURIComponent(related[conv.id]!.key)}`)
                        }
                      }}
                      className={
                        related[conv.id]!.kind === "wallet"
                          ? "text-[10px] px-1.5 py-0.5 leading-none shrink-0 cursor-pointer bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                          : "text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-muted text-muted-foreground border-border"
                      }
                    >
                      {related[conv.id]!.kind === "wallet" ? "Returning" : "Same browser"} · {related[conv.id]!.total}
                    </Badge>
                  )}
                  {findingKind && (
                    <Badge
                      title={findingKind === "bug"
                        ? "Started as a bug report. The filed report is on Findings."
                        : "Started as feedback. The recorded note is on Findings."}
                      className={findingKind === "bug"
                        ? "text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-sky-500/10 text-sky-400 border-sky-500/20"}
                    >
                      {findingKind === "bug" ? "Bug report" : "Feedback"}
                    </Badge>
                  )}
                  {outcomeMeta && (
                    <Badge
                      title={outcomeMeta.title}
                      className={OUTCOME_BADGE[outcome]}
                    >
                      {outcomeMeta.label}
                    </Badge>
                  )}
                  {outcome === "answered" && tRef && (
                    <Badge
                      title="Answered, then handed to a human."
                      className="text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                    >
                      Escalated
                    </Badge>
                  )}
                  {hasNegative && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 leading-none shrink-0">Low satisfaction</Badge>
                  )}
                  {tRef && (
                    <Badge className="text-[10px] px-1.5 py-0.5 leading-none shrink-0 bg-indigo-500/10 text-indigo-400 border-indigo-500/20 flex items-center gap-1">
                      <Ticket className="size-2.5" />
                      {tRef}
                    </Badge>
                  )}
                  {sourceOf(conv.session_id) === "telegram" && (
                    <Badge variant="outline" className="shrink-0 text-[10px]">Telegram</Badge>
                  )}
                </div>
                <p className="text-sm truncate text-muted-foreground">
                  {tag?.summary || preview || "No messages"}
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {tag && (
                  <span
                    className={`size-2 rounded-full ${SENTIMENT_DOT[tag.sentiment] ?? SENTIMENT_DOT.neutral}`}
                    title={`Sentiment: ${tag.sentiment}`}
                  />
                )}
                <span className="text-xs text-muted-foreground">{msgCount} msg{msgCount !== 1 ? "s" : ""}</span>
                <span suppressHydrationWarning className="text-xs text-muted-foreground">{timeAgo(conv.created_at)}</span>
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
                      ? (
                        <button
                          onClick={() => router.push(`/dashboard/conversations?wallet=${encodeURIComponent(conv.wallet_address!)}`)}
                          className="text-xs font-mono text-foreground break-all text-left hover:text-primary hover:underline underline-offset-2 transition-colors"
                          title="Filter by this wallet"
                        >
                          {conv.wallet_address}
                        </button>
                      )
                      : <p className="text-xs text-muted-foreground">Anonymous</p>}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mb-0.5">Network</p>
                    <p className="text-xs text-foreground">{chainName ?? "-"}</p>
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

                {/* AI summary (cached, categorised) */}
                {tag?.summary && (
                  <div className="px-4 pt-3 pb-2">
                    <div className="rounded-md bg-primary/5 border border-primary/10 px-3 py-2 text-xs text-foreground/80 italic">
                      {tag.summary}
                    </div>
                  </div>
                )}

                {/* Transcript */}
                <div className="px-4 pb-3 pt-1 space-y-2.5">
                  {conv.messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`relative flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {msg.role === "assistant" && (
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary mt-0.5">AI</div>
                      )}
                      {/* pre-wrap: the widget composer allows multi-line
                          messages, and the reviewer must see the same line
                          breaks the user typed. */}
                      <div
                        className={`max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-xs leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background border border-border"
                        }`}
                      >
                        {msg.content}
                        {msg.created_at && (
                          <div
                            className={`mt-1 text-[9px] tabular-nums opacity-60 ${msg.role === "user" ? "text-right" : ""}`}
                            title={new Date(msg.created_at).toLocaleString()}
                          >
                            {/* DATE SHOWN whenever the message is not from the
                                day the session started. A support conversation
                                can span midnight or be picked up days later,
                                and a bare time then silently misdates the
                                record an auditor is reading. */}
                            {new Date(msg.created_at).toDateString() !== new Date(conv.created_at).toDateString() && (
                              <>{new Date(msg.created_at).toLocaleDateString([], { day: "2-digit", month: "short" })}{" "}</>
                            )}
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </div>
                        )}
                      </div>
                      {msg.role === "assistant" && msg.evidence && (
                        <EvidenceBadge evidence={msg.evidence} />
                      )}
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
                      {tRef} raised -{" "}
                      <a href="/dashboard/tickets" className="underline hover:no-underline">
                        View tickets
                      </a>
                    </span>
                  ) : tStatus === "error" ? (
                    <span className="max-w-[70%] text-right text-xs text-destructive">
                      {ticketErrors[conv.id] ?? "Failed to create ticket."}
                    </span>
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
