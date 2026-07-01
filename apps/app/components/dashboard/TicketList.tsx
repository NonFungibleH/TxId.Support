"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ChevronDown, ChevronRight, Mail } from "lucide-react"
import { updateTicketStatus, updateTicketNotes } from "@/lib/actions/tickets"
import { updateConfig } from "@/lib/actions/project"
import type { Ticket } from "@/lib/actions/tickets"

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  open:        { label: "Open",        variant: "default" },
  in_progress: { label: "In progress", variant: "secondary" },
  resolved:    { label: "Resolved",    variant: "outline" },
}

const REASON_LABELS: Record<string, string> = {
  unresolved:    "Unresolved by bot",
  user_requested: "User requested",
  account_issue: "Account issue",
  billing:       "Billing",
  urgent:        "Urgent",
}

function TicketRow({ ticket }: { ticket: Ticket }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [notes, setNotes] = useState(ticket.notes ?? "")

  const status = STATUS_LABELS[ticket.status] ?? STATUS_LABELS.open
  // conversation may be a parsed JSONB array, a JSON-stringified array, or a legacy UUID string
  const rawConv = ticket.conversation
  const conversation: Array<{ role: string; content: string }> | null = (() => {
    if (Array.isArray(rawConv)) return rawConv
    if (typeof rawConv === "string" && rawConv.startsWith("[")) {
      try { return JSON.parse(rawConv) } catch { return null }
    }
    return null
  })()

  function cycleStatus() {
    const next: Record<string, "open" | "in_progress" | "resolved"> = {
      open: "in_progress",
      in_progress: "resolved",
      resolved: "open",
    }
    startTransition(async () => {
      try {
        await updateTicketStatus(ticket.id, next[ticket.status] ?? "open")
      } catch {
        toast.error("Failed to update status")
      }
    })
  }

  function saveNotes() {
    startTransition(async () => {
      try {
        await updateTicketNotes(ticket.id, notes)
        toast.success("Notes saved")
      } catch {
        toast.error("Failed to save notes")
      }
    })
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="text-muted-foreground shrink-0"
        >
          {open
            ? <ChevronDown className="size-4" />
            : <ChevronRight className="size-4" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{ticket.ref}</span>
            {ticket.reason && (
              <span className="text-[11px] opacity-50">{REASON_LABELS[ticket.reason] ?? ticket.reason}</span>
            )}
          </div>
          <p className="text-sm font-medium truncate mt-0.5">{ticket.summary}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {ticket.user_name && (
              <span className="text-xs text-muted-foreground">{ticket.user_name}</span>
            )}
            {ticket.user_email && (
              <a
                href={`mailto:${ticket.user_email}`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="size-3" />
                {ticket.user_email}
              </a>
            )}
            <span className="text-xs text-muted-foreground">
              {new Date(ticket.created_at).toLocaleDateString("en-GB", {
                day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
        </div>

        <button
          onClick={cycleStatus}
          disabled={isPending}
          title="Click to change status"
          className="shrink-0 transition-opacity disabled:opacity-40"
        >
          <Badge variant={status.variant} className="text-xs cursor-pointer">
            {status.label}
          </Badge>
        </button>
      </div>

      {/* Expanded detail */}
      {open && (
        <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
          {/* Conversation transcript */}
          {conversation && conversation.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Conversation</p>
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {conversation.map((msg, i) => (
                  <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : ""}`}>
                    <span className={`text-[11px] px-2.5 py-1.5 rounded-xl leading-relaxed max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {msg.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Internal notes */}
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Internal notes</p>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Add notes for the team…"
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring resize-none"
            />
            <Button size="sm" variant="outline" onClick={saveNotes} disabled={isPending}>
              Save notes
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface TicketListProps {
  projectId: string
  tickets: Ticket[]
  notificationEmail: string
  webhookUrl: string
}

export function TicketList({ projectId, tickets, notificationEmail, webhookUrl }: TicketListProps) {
  const [email, setEmail] = useState(notificationEmail)
  const [webhook, setWebhook] = useState(webhookUrl)
  const [isPending, startTransition] = useTransition()

  function saveEmail() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { notificationEmail: email || null })
        toast.success("Notification email saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  function saveWebhook() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { webhookUrl: webhook || null })
        toast.success("Webhook URL saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  const open     = tickets.filter(t => t.status === "open")
  const progress = tickets.filter(t => t.status === "in_progress")
  const resolved = tickets.filter(t => t.status === "resolved")

  return (
    <div className="space-y-6">
      {/* Email notifications */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">Email notifications</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get notified when a new ticket is raised. Requires{" "}
            <code className="text-xs bg-muted px-1 rounded">RESEND_API_KEY</code> to be set.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="email"
            placeholder="team@yourprotocol.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={saveEmail} disabled={isPending}>
            Save
          </Button>
        </div>
      </div>

      {/* Webhook notifications */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold">Escalation webhook</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            POST request sent to your URL when a ticket is created — use it to ping Slack, Discord, or your own system.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="url"
            placeholder="https://hooks.slack.com/services/..."
            value={webhook}
            onChange={e => setWebhook(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={saveWebhook} disabled={isPending}>
            Save
          </Button>
        </div>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            When the bot can&apos;t resolve an issue, it offers to raise a ticket.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {open.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Open · {open.length}
              </p>
              {open.map(t => <TicketRow key={t.id} ticket={t} />)}
            </section>
          )}
          {progress.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                In Progress · {progress.length}
              </p>
              {progress.map(t => <TicketRow key={t.id} ticket={t} />)}
            </section>
          )}
          {resolved.length > 0 && (
            <section className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Resolved · {resolved.length}
              </p>
              {resolved.map(t => <TicketRow key={t.id} ticket={t} />)}
            </section>
          )}
        </div>
      )}
    </div>
  )
}
