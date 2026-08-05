import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { History } from "lucide-react"
import type { AuditRow } from "@/lib/audit"

/** Dotted verbs read badly in a table. Say what happened instead. */
const ACTION_LABEL: Record<string, string> = {
  "config.updated": "Settings changed",
  "integration.saved": "Integration saved",
  "escalation.redelivered": "Escalation re-sent",
  "widget.enabled": "Widget switched on",
  "widget.disabled": "Widget switched off",
}

function label(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/\./g, " ").replace(/_/g, " ")
}

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString()
}

/**
 * Who changed what, and when.
 *
 * The case record proves what the assistant said and what it read. This
 * answers the question a security reviewer asks straight afterwards: who
 * changed the settings that produced it. Append-only in Postgres, so the row
 * cannot be edited by the product that wrote it.
 */
export function AuditList({ rows }: { rows: AuditRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <CardTitle className="text-base">Change history</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">
          Every configuration change, with who made it. Append-only: these entries cannot be
          edited or deleted, including by us. Credential values are never recorded, only the
          fact that one changed.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No changes recorded yet. Entries appear here from the next settings change.
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map(row => {
              const fields = Array.isArray(row.metadata.fields)
                ? (row.metadata.fields as unknown[]).filter(f => typeof f === "string")
                : []
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium">
                      {label(row.action)}
                      {row.target && (
                        <span className="ml-1.5 font-normal text-muted-foreground">
                          {row.target}
                        </span>
                      )}
                    </p>
                    {fields.length > 0 && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {fields.join(", ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] text-muted-foreground">
                      {row.actorName ?? row.actorEmail ?? row.actorId}
                    </p>
                    {row.actorName && row.actorEmail && (
                      <p className="text-[10px] text-muted-foreground/60">{row.actorEmail}</p>
                    )}
                    <p className="font-mono text-[10px] tabular-nums text-muted-foreground/70">
                      {when(row.createdAt)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
