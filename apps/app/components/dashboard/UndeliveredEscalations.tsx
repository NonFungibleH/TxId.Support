"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { AlertTriangle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { retryDelivery, type FailedDelivery } from "@/lib/actions/integrations"

const TARGET_NAMES: Record<string, string> = {
  slack: "Slack",
  discord: "Discord",
  telegram: "Telegram",
  linear: "Linear",
  github: "GitHub",
  jira: "Jira",
}

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString()
}

/**
 * Escalations that never arrived.
 *
 * A user asked for a human and was told one was coming. If the delivery failed,
 * that promise is outstanding and nobody on the team knows. Showing an empty
 * state here is the point: silence should mean nothing is owed, not that we
 * stopped looking.
 */
export function UndeliveredEscalations({ deliveries }: { deliveries: FailedDelivery[] }) {
  const [rows, setRows] = useState(deliveries)
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  if (rows.length === 0) return null

  const onRetry = (id: string) => {
    setBusy(id)
    startTransition(async () => {
      const res = await retryDelivery(id)
      setBusy(null)
      if (res.ok) {
        setRows(prev => prev.filter(r => r.id !== id))
        toast.success("Delivered")
      } else {
        toast.error(res.error ?? "Still failing")
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-amber-600" />
        <div>
          <h2 className="text-sm font-semibold">Escalations that did not arrive</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            These users were told a human would follow up. Retries run automatically every 10
            minutes, backing off up to 6 hours. Fix the integration, then retry to confirm.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map(row => (
          <li
            key={row.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5"
          >
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold">
                  {TARGET_NAMES[row.target] ?? row.target}
                </span>
                <code className="font-mono text-[11px] text-muted-foreground">{row.ticketRef}</code>
                {row.status === "abandoned" ? (
                  <Badge variant="destructive" className="text-[10px]">Given up</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Attempt {row.attempts}, next {when(row.nextAttemptAt)}
                  </Badge>
                )}
              </div>
              {row.lastError && (
                <p className="line-clamp-2 text-[11px] text-muted-foreground">{row.lastError}</p>
              )}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={busy === row.id}
              onClick={() => onRetry(row.id)}
            >
              <RotateCw className={`mr-1.5 size-3.5 ${busy === row.id ? "animate-spin" : ""}`} />
              Retry now
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
