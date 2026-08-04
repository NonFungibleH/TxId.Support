"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Mail, Link2, StickyNote, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  setTicketStatus, setTicketPriority, assignTicket, logTicketComm, getTicketEvents,
  type TicketStatus, type TicketPriority, type EventChannel, type TicketEvent,
} from "@/lib/actions/ticket-inbox"

const STATUSES: { value: TicketStatus; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "waiting", label: "Waiting on user" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
]

const PRIORITIES: TicketPriority[] = ["low", "normal", "high", "urgent"]

const KIND_ICON: Record<string, typeof Mail> = {
  reply: Mail,
  link: Link2,
  note: StickyNote,
}

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString()
}

function describe(e: TicketEvent): string {
  if (e.kind === "status_changed") return `Status set to ${e.body?.replace(/_/g, " ")}`
  if (e.kind === "priority_changed") return `Priority set to ${e.body}`
  if (e.kind === "assigned") return e.body === "unassigned" ? "Unassigned" : `Assigned to ${e.body}`
  if (e.kind === "reply") return `Replied${e.channel ? ` by ${e.channel}` : ""}`
  if (e.kind === "link") return `Linked${e.channel ? ` to ${e.channel}` : ""}`
  return "Note"
}

/**
 * Working a ticket, and recording what was done.
 *
 * The reply itself happens elsewhere: someone answers from their own mailbox
 * or a CRM. Logging it here is what keeps the trail continuous, because
 * otherwise the record stops at "escalated" and resumes nowhere, which is
 * precisely the gap an auditor asks about.
 */
export function TicketWorkspace({
  ticketId,
  status,
  priority,
  assigneeEmail,
  teammates,
}: {
  ticketId: string
  status: TicketStatus
  priority: TicketPriority | null
  assigneeEmail: string | null
  teammates: { userId: string; email: string }[]
}) {
  const [events, setEvents] = useState<TicketEvent[] | null>(null)
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)

  const [kind, setKind] = useState<"reply" | "note" | "link">("reply")
  const [channel, setChannel] = useState<EventChannel>("email")
  const [body, setBody] = useState("")
  const [url, setUrl] = useState("")

  const reload = () => { void getTicketEvents(ticketId).then(setEvents).catch(() => setEvents([])) }
  useEffect(reload, [ticketId])

  const run = (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    startTransition(async () => {
      try { await fn(); toast.success(ok); reload() }
      catch (err) { toast.error(err instanceof Error ? err.message : "Failed") }
      finally { setBusy(false) }
    })
  }

  const record = () => {
    run(
      () => logTicketComm(ticketId, {
        kind,
        ...(kind !== "note" ? { channel } : {}),
        ...(body.trim() ? { body: body.trim() } : {}),
        ...(url.trim() ? { url: url.trim() } : {}),
      }),
      "Recorded",
    )
    setBody(""); setUrl("")
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          disabled={busy}
          onChange={e => run(() => setTicketStatus(ticketId, e.target.value as TicketStatus), "Status updated")}
          className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:border-ring"
          aria-label="Status"
        >
          {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          value={priority ?? "normal"}
          disabled={busy}
          onChange={e => run(() => setTicketPriority(ticketId, e.target.value as TicketPriority), "Priority updated")}
          className="rounded-md border border-input bg-transparent px-2 py-1 text-xs capitalize outline-none focus:border-ring"
          aria-label="Priority"
        >
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        <select
          value={assigneeEmail ?? ""}
          disabled={busy}
          onChange={e => {
            const mate = teammates.find(t => t.email === e.target.value)
            run(() => assignTicket(ticketId, mate?.userId ?? null, mate?.email ?? null), "Assigned")
          }}
          className="rounded-md border border-input bg-transparent px-2 py-1 text-xs outline-none focus:border-ring"
          aria-label="Assignee"
        >
          <option value="">Unassigned</option>
          {teammates.map(t => <option key={t.userId} value={t.email}>{t.email}</option>)}
        </select>
      </div>

      {/* Record what happened outside TxID */}
      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          {(["reply", "note", "link"] as const).map(k => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize transition-colors ${
                kind === k ? "border-primary/40 bg-primary/10 text-primary" : "border-border text-muted-foreground"
              }`}
            >
              {k === "reply" ? "Replied to user" : k === "link" ? "Link a record" : "Internal note"}
            </button>
          ))}
          {kind !== "note" && (
            <select
              value={channel}
              onChange={e => setChannel(e.target.value as EventChannel)}
              className="rounded-md border border-input bg-transparent px-2 py-0.5 text-[11px] outline-none"
              aria-label="Channel"
            >
              {(["email", "telegram", "discord", "crm", "other"] as const).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
        </div>

        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={2}
          placeholder={
            kind === "reply" ? "What you told the user…"
            : kind === "link" ? "What this record is…"
            : "Note for the team…"
          }
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
        />
        {kind === "link" && (
          <input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://your-crm/contact/123"
            className="w-full rounded-lg border border-input bg-transparent px-3 py-1.5 font-mono text-xs outline-none focus:border-ring"
          />
        )}
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={record} disabled={busy}>
            Record
          </Button>
          <p className="text-[11px] text-muted-foreground">
            TxID does not send the message. Recording it keeps the trail continuous.
          </p>
        </div>
      </div>

      {/* History */}
      <div className="space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
        {events === null ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nothing recorded yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {events.map(e => {
              const Icon = KIND_ICON[e.kind]
              return (
                <li key={e.id} className="flex items-start gap-2 text-xs">
                  {Icon ? <Icon className="mt-0.5 size-3 shrink-0 text-muted-foreground" /> : <span className="mt-1 size-1.5 shrink-0 rounded-full bg-border" />}
                  <div className="min-w-0">
                    <p>
                      <span className="font-medium">{describe(e)}</span>
                      {e.actorEmail && <span className="text-muted-foreground"> by {e.actorEmail}</span>}
                      <span className="text-muted-foreground/70"> · {when(e.createdAt)}</span>
                    </p>
                    {e.body && e.kind !== "status_changed" && e.kind !== "priority_changed" && e.kind !== "assigned" && (
                      <p className="text-muted-foreground">{e.body}</p>
                    )}
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                        {e.url.slice(0, 60)}<ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
