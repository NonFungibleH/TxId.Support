"use client"

import {
  ArrowLeft as ArrowLeftIcon,
  CircleCheck as CircleCheckIcon,
  CircleAlert as CircleAlertIcon,
  CircleDashed as CircleDashedIcon,
  Info as InfoIcon,
  ExternalLink as ExternalLinkIcon,
  MessageCircle as MessageCircleIcon,
} from "lucide-react"
import type { ChecklistItem, ItemStatus } from "@/lib/activation/readiness"
import type { ReadinessResponse } from "./useActivation"

/**
 * The readiness checklist, as the user sees it.
 *
 * Grouped by status under plain labels, because the grouping is the message:
 * what is fine, what to do, what your wallet is about to ask you. The ready
 * group comes first on purpose, so someone about to sign their first
 * transaction reads what is already in place before what is not.
 *
 * Status is carried by icon AND label AND colour, never colour alone.
 */

interface Palette {
  primary: string
  onPrimary: string
  text: string
  background: string
  bgIsLight: boolean
}

const GROUPS: { status: ItemStatus; label: string }[] = [
  { status: "ready", label: "Ready" },
  { status: "todo", label: "To do first" },
  { status: "expect", label: "What to expect" },
  { status: "unknown", label: "Couldn't check" },
]

function tone(status: ItemStatus, p: Palette): string {
  // Semantic colour, separate from the brand. Two shades so both hold contrast
  // on a light or a dark panel.
  if (status === "ready") return p.bgIsLight ? "#15803d" : "#4ade80"
  if (status === "todo") return p.bgIsLight ? "#b45309" : "#fbbf24"
  if (status === "expect") return p.primary
  return p.bgIsLight ? "#6b7280" : "#9ca3af"
}

function StatusIcon({ status, color }: { status: ItemStatus; color: string }) {
  const cls = "size-4 shrink-0 mt-px"
  if (status === "ready") return <CircleCheckIcon className={cls} style={{ color }} aria-hidden />
  if (status === "todo") return <CircleAlertIcon className={cls} style={{ color }} aria-hidden />
  if (status === "expect") return <InfoIcon className={cls} style={{ color }} aria-hidden />
  return <CircleDashedIcon className={cls} style={{ color }} aria-hidden />
}

function Item({ item, p, onAsk, failure }: { item: ChecklistItem; p: Palette; onAsk: (q: string) => void; failure?: boolean }) {
  const color = tone(item.status, p)
  return (
    <li
      className="flex gap-2.5 rounded-xl px-3 py-2.5"
      style={{
        backgroundColor: failure ? `${color}14` : `${p.text}08`,
        border: `1px solid ${failure ? `${color}55` : `${p.text}14`}`,
      }}
    >
      <StatusIcon status={item.status} color={color} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium leading-snug" style={{ textWrap: "balance" } as React.CSSProperties}>{item.title}</p>
        {item.detail && <p className="mt-0.5 text-[11px] leading-relaxed opacity-75">{item.detail}</p>}
        {item.ask && (
          <button
            type="button"
            onClick={() => onAsk(item.ask!)}
            className="mt-1.5 inline-flex items-center gap-1 rounded-md text-[11px] font-medium underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ color: p.primary }}
          >
            <MessageCircleIcon className="size-3" aria-hidden />
            Ask about this
          </button>
        )}
      </div>
    </li>
  )
}

export function ReadinessPanel({
  readiness,
  palette: p,
  projectName,
  onAsk,
  onBack,
}: {
  readiness: ReadinessResponse
  palette: Palette
  projectName: string
  onAsk: (question: string) => void
  onBack: () => void
}) {
  const action = readiness.action ?? "transaction"
  const done = readiness.state === "activated"
  const checklist = readiness.checklist

  return (
    <div
      className="absolute inset-0 z-20 flex flex-col"
      style={{ backgroundColor: p.background, color: p.text }}
      role="region"
      aria-label="Wallet readiness check"
    >
      <div className="flex items-center gap-2 px-3 pt-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] opacity-70 hover:opacity-100 focus-visible:outline focus-visible:outline-2"
        >
          <ArrowLeftIcon className="size-3.5" aria-hidden />
          Back to chat
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
        {done ? (
          <div className="flex flex-col items-center px-4 pt-10 text-center">
            <CircleCheckIcon className="size-10" style={{ color: tone("ready", p) }} aria-hidden />
            <p className="mt-3 text-sm font-semibold" style={{ textWrap: "balance" } as React.CSSProperties}>
              Your first {action} on {projectName} went through
            </p>
            <p className="mt-1 text-[11px] opacity-70">If anything about it looks off, ask and I&apos;ll look at the transaction with you.</p>
            <button
              type="button"
              onClick={onBack}
              className="mt-4 rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ backgroundColor: p.primary, color: p.onPrimary }}
            >
              Back to chat
            </button>
          </div>
        ) : checklist ? (
          <>
            <div className="pt-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">Readiness check</p>
              <h2 className="mt-1 text-sm font-semibold leading-snug" style={{ textWrap: "balance" } as React.CSSProperties}>
                {checklist.headline}
              </h2>
              {checklist.checkable > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex flex-1 gap-1" aria-hidden>
                    {Array.from({ length: checklist.checkable }, (_, i) => (
                      <span
                        key={i}
                        className="h-1 flex-1 rounded-full"
                        style={{ backgroundColor: i < checklist.ready ? tone("ready", p) : `${p.text}22` }}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] tabular-nums opacity-70">
                    {checklist.ready} of {checklist.checkable} ready
                  </span>
                </div>
              )}
            </div>

            {checklist.items.filter(i => i.id === "failure").map(i => (
              <ul key="failure" className="mt-3 space-y-2">
                <Item item={i} p={p} onAsk={onAsk} failure />
              </ul>
            ))}

            {GROUPS.map(g => {
              const items = checklist.items.filter(i => i.status === g.status && i.id !== "failure")
              if (items.length === 0) return null
              return (
                <section key={g.status} className="mt-4">
                  <h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color: tone(g.status, p) }}>
                    {g.label}
                  </h3>
                  <ul className="space-y-2">
                    {items.map(i => <Item key={i.id} item={i} p={p} onAsk={onAsk} />)}
                  </ul>
                </section>
              )
            })}

            <p className="mt-4 text-[10px] leading-relaxed opacity-55">
              Read from public chain data just now. Nothing here is advice about what or how much to {action}.
            </p>
          </>
        ) : null}
      </div>

      {!done && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2.5" style={{ borderColor: `${p.text}14` }}>
          {readiness.guideUrl ? (
            <a
              href={readiness.guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] underline-offset-2 hover:underline"
              style={{ color: p.primary }}
            >
              Getting started guide
              <ExternalLinkIcon className="size-3" aria-hidden />
            </a>
          ) : <span />}
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg px-3 py-1.5 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: p.primary, color: p.onPrimary }}
          >
            Ask a question
          </button>
        </div>
      )}
    </div>
  )
}
