"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react"

export interface Finding {
  id: string
  ref: string
  summary: string
  created_at: string
  /** The transcript, stored as JSON on the ticket when it was recorded. */
  conversation: string | null
}

/**
 * Findings that open where they are.
 *
 * They used to link to Conversations, which threw away the thing that made the
 * finding worth having: a tester saying "the fee display is confusing" means
 * nothing without seeing which screen they were on when they said it. Sending
 * someone to another page, to search for a reference, to reconstruct that, is
 * how a feature that reads well in a demo goes unused in practice.
 */
export function FindingList({ findings, emptyHint }: { findings: Finding[]; emptyHint: string }) {
  const [open, setOpen] = useState<string | null>(null)

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
        <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {findings.map(f => {
        const isOpen = open === f.id
        // Stored as a JSON string when the finding was recorded. Malformed or
        // absent is normal for older rows and must not break the page.
        let turns: { role: string; content: string }[] = []
        try {
          const parsed: unknown = f.conversation ? JSON.parse(f.conversation) : []
          if (Array.isArray(parsed)) turns = parsed as { role: string; content: string }[]
        } catch { /* older row, show the summary alone */ }

        return (
          <div key={f.id} className="rounded-lg border border-border">
            <button
              onClick={() => setOpen(isOpen ? null : f.id)}
              className="flex w-full items-start justify-between gap-4 px-3 py-2.5 text-left transition-colors hover:bg-muted/40"
            >
              <div className="min-w-0">
                <p className="text-sm">{f.summary}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground">
                  <span className="font-mono">{f.ref}</span>
                  <span className="opacity-40">·</span>
                  <span>{new Date(f.created_at).toLocaleString()}</span>
                  {turns.length > 0 && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="size-2.5" />
                        {turns.length}
                      </span>
                    </>
                  )}
                </div>
              </div>
              {isOpen
                ? <ChevronUp className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                : <ChevronDown className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
            </button>

            {isOpen && (
              <div className="border-t border-border px-3 py-3">
                {turns.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No transcript was stored with this one.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {turns.map((t, i) => (
                      <div
                        key={i}
                        className={t.role === "user" ? "flex justify-end" : "flex justify-start"}
                      >
                        <div
                          className={
                            t.role === "user"
                              ? "max-w-[80%] rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs"
                              : "max-w-[80%] rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs"
                          }
                        >
                          {t.content}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
