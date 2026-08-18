"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, MessageSquare } from "lucide-react"

export interface Finding {
  id: string
  ref: string
  summary: string
  created_at: string
  /**
   * The transcript recorded with the finding.
   *
   * TYPED AS UNKNOWN ON PURPOSE. The column is `jsonb`, so Supabase hands back
   * an already-parsed array, while the writer passes a JSON string that
   * Postgres parses on the way in. Assuming either shape breaks the other, and
   * assuming "string" silently turned every transcript into "none stored".
   */
  conversation: unknown
  /** The user's wallet, when the host supplied it or the user connected. */
  wallet_address?: string | null
  /**
   * The case record: the request context the finding was filed under (the page
   * they were on, coarse device, country/region), the same compliance evidence
   * the Conversations tab shows. jsonb, so it arrives already parsed. No raw IP.
   */
  request?: {
    pageUrl?: string
    surface?: string
    country?: string
    region?: string
    deviceType?: string
    platform?: string
    browser?: string
  } | null
}

function pageLabel(url?: string): string | null {
  if (!url) return null
  try { const u = new URL(url); return u.host + (u.pathname === "/" ? "" : u.pathname) } catch { return url.slice(0, 120) }
}
function deviceLabel(r: NonNullable<Finding["request"]>): string | null {
  const parts = [r.platform, r.browser, r.deviceType].filter(Boolean)
  return parts.length ? parts.join(" · ") : null
}
function locationLabel(r: NonNullable<Finding["request"]>): string | null {
  const parts = [r.region, r.country].filter(Boolean)
  return parts.length ? parts.join(", ") : null
}
function hasCaseRecord(r?: Finding["request"]): r is NonNullable<Finding["request"]> {
  return !!r && !!(r.pageUrl || r.platform || r.browser || r.deviceType || r.country || r.region)
}

/** Accept both shapes, and never let a malformed one break the page. */
function turnsOf(value: unknown): { role: string; content: string }[] {
  const parsed = typeof value === "string"
    ? (() => { try { return JSON.parse(value) as unknown } catch { return null } })()
    : value
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (t): t is { role: string; content: string } =>
      !!t && typeof t === "object" &&
      typeof (t as { role?: unknown }).role === "string" &&
      typeof (t as { content?: unknown }).content === "string",
  )
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
        const turns = turnsOf(f.conversation)

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
                  {f.wallet_address && (
                    <>
                      <span className="opacity-40">·</span>
                      {/* Asserted by the host site, not proven by a signature.
                          Labelled so a support lead does not read it as an
                          authenticated wallet. */}
                      <span
                        className="font-mono"
                        title={`${f.wallet_address} (asserted by the host site, not a signed proof of ownership)`}
                      >
                        {f.wallet_address.length > 13
                          ? `${f.wallet_address.slice(0, 6)}…${f.wallet_address.slice(-4)}`
                          : f.wallet_address}
                      </span>
                      <span className="opacity-50">(unverified)</span>
                    </>
                  )}
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
                {hasCaseRecord(f.request) && (
                  <div className="mb-3 rounded-md bg-muted/40 px-2.5 py-2 text-[11px]">
                    <p className="mb-1 font-medium text-foreground/80">Case record</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-muted-foreground">
                      {pageLabel(f.request!.pageUrl) && (
                        <>
                          <dt>Page</dt>
                          <dd className="break-all font-mono text-foreground/90" title={f.request!.pageUrl}>{pageLabel(f.request!.pageUrl)}</dd>
                        </>
                      )}
                      {deviceLabel(f.request!) && (
                        <>
                          <dt>Device</dt>
                          <dd className="text-foreground/90">{deviceLabel(f.request!)}</dd>
                        </>
                      )}
                      {locationLabel(f.request!) && (
                        <>
                          <dt>Location</dt>
                          <dd className="text-foreground/90">{locationLabel(f.request!)}</dd>
                        </>
                      )}
                      {f.wallet_address && (
                        <>
                          <dt>Wallet</dt>
                          <dd className="break-all font-mono text-foreground/90">{f.wallet_address} <span className="text-muted-foreground">(unverified)</span></dd>
                        </>
                      )}
                    </dl>
                  </div>
                )}
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
                              ? "max-w-[80%] whitespace-pre-wrap rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs"
                              : "max-w-[80%] whitespace-pre-wrap rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-xs"
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
