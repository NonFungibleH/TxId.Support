import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { History } from "lucide-react"
import type { AuditRow, FieldChange } from "@/lib/audit"

/** Config keys are camelCase in storage and unreadable in a log. */
function fieldLabel(f: string): string {
  return f
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, c => c.toUpperCase())
}

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
          Every configuration change, with who made it and what it was before. Append-only:
          entries cannot be edited or deleted through the dashboard. Credential values are
          never recorded, only the fact that one was set or cleared.
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
              // Rows written before the before/after change still carry only
              // key names. Render whichever the row actually has rather than
              // showing a blank line for the older ones.
              const changes = (Array.isArray(row.metadata.changes)
                ? (row.metadata.changes as unknown[]).filter(
                    (c): c is FieldChange =>
                      !!c && typeof c === "object" && typeof (c as FieldChange).field === "string",
                  )
                : [])
              const fields = changes.length === 0 && Array.isArray(row.metadata.fields)
                ? (row.metadata.fields as unknown[]).filter((f): f is string => typeof f === "string")
                : []
              return (
                <li
                  key={row.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2"
                >
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs font-medium">{label(row.action)}</p>
                    {changes.length > 0 && (
                      <ul className="space-y-0.5">
                        {changes.map((c, i) => (
                          <li key={`${c.field}-${i}`} className="text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">{fieldLabel(c.field)}</span>
                            {": "}
                            <span className="font-mono line-through opacity-60">{c.from}</span>
                            <span className="mx-1 opacity-40">&rarr;</span>
                            <span className="font-mono text-foreground">{c.to}</span>
                          </li>
                        ))}
                      </ul>
                    )}
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
