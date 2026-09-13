import { AlertCircle } from "lucide-react"

/**
 * What a page shows when a read did not complete.
 *
 * Distinct from the empty state on purpose. "No cases" is a statement about
 * the customers; this is a statement about us, and it says so, because an
 * inbox that reads "nothing to do" during an outage is the one thing a support
 * lead must never be shown.
 */
export function ConsoleUnavailable({ what, reason }: { what: string; reason: string }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
        {what} could not be loaded
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        The read did not complete, so nothing is shown. This says nothing about your customers or their transactions: it is a limit of this page right now. Reload in a moment.
      </p>
      <p className="mt-2 font-mono text-[11px] text-muted-foreground break-all">{reason}</p>
    </div>
  )
}
