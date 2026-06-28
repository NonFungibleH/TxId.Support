"use client"

import { CheckCircle2, XCircle, Clock } from "lucide-react"
import type { WebhookLog } from "@/lib/actions/tickets"

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function WebhookLogList({ logs }: { logs: WebhookLog[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-6 text-center">
        No deliveries yet — they appear here when a ticket is raised and a webhook URL is configured.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center gap-3 rounded-lg border border-border px-4 py-2.5 text-xs bg-card"
        >
          {log.success
            ? <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
            : <XCircle className="size-3.5 shrink-0 text-red-500" />}

          <code className="font-mono text-muted-foreground shrink-0">{log.ticket_ref}</code>

          <span
            className="flex-1 truncate font-mono text-[11px] text-muted-foreground/70"
            title={log.webhook_url}
          >
            {log.webhook_url}
          </span>

          {log.status_code != null && (
            <span className={`font-mono shrink-0 ${log.success ? "text-green-500" : "text-red-400"}`}>
              {log.status_code}
            </span>
          )}

          {log.error_message && (
            <span
              className="text-red-400 text-[11px] max-w-[120px] truncate shrink-0"
              title={log.error_message}
            >
              {log.error_message}
            </span>
          )}

          {log.duration_ms != null && (
            <span className="text-muted-foreground/50 shrink-0 flex items-center gap-1">
              <Clock className="size-2.5" />
              {log.duration_ms}ms
            </span>
          )}

          <span className="text-muted-foreground/40 shrink-0">{timeAgo(log.fired_at)}</span>
        </div>
      ))}
    </div>
  )
}
