"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { setDocsSync } from "@/lib/actions/docs-sync"

function ago(iso: string | null): string {
  if (!iso) return "never"
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return "never"
  const mins = Math.floor((Date.now() - then) / 60_000)
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? "" : "s"} ago`
}

/**
 * Keep the knowledge base current without anyone remembering to press a button.
 *
 * Two dates, not one, and the difference matters: "last checked" is how fresh
 * the answer to "is this current?" is, and "last changed" is how old the
 * content itself is. A team that only sees one of them cannot tell a working
 * sync from a broken one.
 */
export function DocsSyncForm({
  enabled,
  frequency,
  hasDocsUrl,
  pages,
  lastChecked,
  lastChanged,
}: {
  enabled: boolean
  frequency: "daily" | "weekly"
  hasDocsUrl: boolean
  pages: number
  lastChecked: string | null
  lastChanged: string | null
}) {
  const [on, setOn] = useState(enabled)
  const [freq, setFreq] = useState(frequency)
  const [, startTransition] = useTransition()

  const save = (nextOn: boolean, nextFreq: "daily" | "weekly") => {
    const prevOn = on
    const prevFreq = freq
    setOn(nextOn)
    setFreq(nextFreq)
    startTransition(async () => {
      try {
        await setDocsSync(nextOn, nextFreq)
        toast.success(nextOn ? `Checking ${nextFreq}` : "Automatic checks off")
      } catch (err) {
        setOn(prevOn)
        setFreq(prevFreq)
        toast.error(err instanceof Error ? err.message : "Could not save")
      }
    })
  }

  return (
    <div className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <Label htmlFor="docs-sync" className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="size-3.5 text-muted-foreground" />
            Keep it current automatically
          </Label>
          {/* NO PRICING TALK. This used to reassure the reader that daily was
              cheap, which invites the question of what it costs and frames a
              feature as a meter. Choose on the axis that is actually theirs:
              how often their documentation changes. */}
          <p className="max-w-xl text-xs text-muted-foreground">
            Re-checks your documentation on a schedule and re-indexes only the pages that actually
            changed. Pages you delete are removed too, so the assistant stops answering from
            documentation that no longer exists. Nothing to remember.
          </p>
        </div>
        <Switch
          id="docs-sync"
          checked={on}
          disabled={!hasDocsUrl}
          onCheckedChange={next => save(next, freq)}
        />
      </div>

      {!hasDocsUrl && (
        <p className="text-xs text-amber-600">
          Index a documentation URL above first. There is nothing to re-check yet.
        </p>
      )}

      {on && hasDocsUrl && (
        <div className="flex flex-wrap items-center gap-2">
          {(["daily", "weekly"] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => save(true, f)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                freq === f
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "daily" ? "Daily" : "Weekly"}
            </button>
          ))}
          <span className="text-xs text-muted-foreground">
            Daily suits documentation that changes often. Weekly is enough if yours is stable.
          </span>
        </div>
      )}

      {pages > 0 && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{pages}</span> page
            {pages === 1 ? "" : "s"} tracked
          </span>
          <span>
            Last checked <span className="font-medium text-foreground">{ago(lastChecked)}</span>
          </span>
          <span>
            Last change found <span className="font-medium text-foreground">{ago(lastChanged)}</span>
          </span>
        </div>
      )}
    </div>
  )
}
