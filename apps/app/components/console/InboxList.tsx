import Link from "next/link"
import { allCases } from "@/lib/console/fixtures"
import { AlertTriangle } from "lucide-react"

const OUTCOME_CLS: Record<string, string> = {
  failed: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/25",
  pending: "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/25",
  succeeded: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/25",
}
const OUTCOME_LABEL: Record<string, string> = { failed: "Open", pending: "Waiting", succeeded: "Resolved" }

function when(iso: string) {
  return new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
}

/**
 * The inbox: every failure is a case, every case is a row, every row opens.
 *
 * `cause` arrives from Analytics, which is what makes "41 people hit this"
 * clickable: the number and the list behind it are the same data seen twice.
 */
export function InboxList({ base, cause, status }: { base: string; cause?: string; status?: string }) {
  let cases = allCases()
  if (cause) cases = cases.filter(c => c.code === cause)
  if (status === "open") cases = cases.filter(c => c.outcome === "failed")
  if (status === "waiting") cases = cases.filter(c => c.outcome === "pending")

  const chip = (label: string, href: string, active: boolean) => (
    <Link
      key={label}
      href={href}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:border-primary/40"}`}
    >
      {label}
    </Link>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every failed or stuck transaction across your contracts, newest first.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {chip("All", base + "/inbox", !cause && !status)}
        {chip("Open", base + "/inbox?status=open", status === "open")}
        {chip("Waiting", base + "/inbox?status=waiting", status === "waiting")}
        {cause && chip(`Cause ${cause} ×`, base + "/inbox", true)}
      </div>

      {cases.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Nothing matches this filter. Clear it to see every case.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {cases.map(c => (
            <li key={c.id}>
              <Link
                href={`${base}/inbox/${c.id}`}
                className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40"
              >
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-foreground">{c.intent}</span>
                    {c.fundsAtRisk && (
                      <span className="inline-flex items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="h-2.5 w-2.5" /> Funds at stake
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {c.customerLabel} · {c.chain} · <span className="font-mono">{c.code}</span> · {when(c.at)}
                  </span>
                </span>
                <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${OUTCOME_CLS[c.outcome]}`}>
                  {OUTCOME_LABEL[c.outcome]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
