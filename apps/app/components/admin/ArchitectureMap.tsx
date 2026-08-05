import { ArrowDown } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  STACK, SCHEDULED, HONEST_GAPS, STATUS_LABEL, type NodeStatus,
} from "@/lib/architecture"

const STATUS_CLASS: Record<NodeStatus, string> = {
  live: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  optional: "bg-amber-500/10 text-amber-500 border-amber-500/30",
  aptos: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  planned: "bg-rose-500/10 text-rose-400 border-rose-500/30",
  paused: "bg-muted text-muted-foreground border-border",
}

const DOT_CLASS: Record<NodeStatus, string> = {
  live: "bg-indigo-400",
  optional: "bg-amber-400",
  aptos: "bg-emerald-400",
  planned: "bg-rose-400",
  paused: "bg-muted-foreground/50",
}

/**
 * The whole stack on one page, read top to bottom in the order a question
 * travels: it arrives at a surface, passes the gates, is given context,
 * investigated, verified, recorded, and handed to a person if it has to be.
 *
 * Colour encodes STATE, not importance. Anything not marked live is genuinely
 * not live, which is the same standard the product holds itself to when it
 * answers a user.
 */
export function ArchitectureMap() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(STATUS_CLASS) as NodeStatus[]).map(s => (
          <span
            key={s}
            className={cn("rounded-md border px-2 py-0.5 text-[11px] font-medium", STATUS_CLASS[s])}
          >
            {STATUS_LABEL[s]}
          </span>
        ))}
      </div>

      <div className="space-y-3">
        {STACK.map((layer, i) => (
          <div key={layer.id}>
            <section className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 space-y-1">
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="text-base font-semibold">{layer.title}</h2>
                </div>
                <p className="max-w-3xl pl-8 text-sm text-muted-foreground">{layer.purpose}</p>
              </div>

              <div className="grid gap-2.5 pl-8 sm:grid-cols-2 lg:grid-cols-3">
                {layer.nodes.map(n => (
                  <div
                    key={n.name}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        <span className={cn("size-1.5 shrink-0 rounded-full", DOT_CLASS[n.status])} />
                        {n.name}
                      </p>
                      {n.status !== "live" && (
                        <span
                          className={cn(
                            "shrink-0 rounded border px-1 py-px text-[10px] font-medium",
                            STATUS_CLASS[n.status],
                          )}
                        >
                          {STATUS_LABEL[n.status]}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{n.detail}</p>
                    {n.where && (
                      <p className="mt-1.5 break-all font-mono text-[10px] text-muted-foreground/60">
                        {n.where}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {i < STACK.length - 1 && (
              <div className="flex justify-center py-1" aria-hidden="true">
                <ArrowDown className="size-4 text-muted-foreground/40" />
              </div>
            )}
          </div>
        ))}
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-1 text-base font-semibold">Runs without anyone pressing a button</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Scheduled in <span className="font-mono text-xs">apps/app/vercel.json</span>. The app is
          its own Vercel project, so the schedule lives there and not at the repo root.
        </p>
        <ul className="space-y-2.5">
          {SCHEDULED.map(j => (
            <li key={j.path} className="rounded-lg border border-border bg-background p-3">
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-mono text-xs text-indigo-400">{j.path}</span>
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {j.cadence}
                </span>
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{j.what}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-5">
        <h2 className="mb-1 text-base font-semibold">What is not built</h2>
        <p className="mb-4 max-w-3xl text-sm text-muted-foreground">
          Stated plainly, because the same honesty is what the record is for. These are the things
          a buyer would reasonably assume exist and would be wrong.
        </p>
        <ul className="space-y-3">
          {HONEST_GAPS.map(g => (
            <li key={g.title}>
              <p className="text-sm font-medium">{g.title}</p>
              <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">{g.detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
