import { cn } from "@/lib/utils"
import {
  STACK, SCHEDULED, HONEST_GAPS, STATUS_LABEL, type NodeStatus,
} from "@/lib/architecture"

const ACCENT: Record<NodeStatus, string> = {
  live: "text-indigo-500 dark:text-indigo-400",
  optional: "text-amber-600 dark:text-amber-400",
  aptos: "text-emerald-600 dark:text-emerald-400",
  planned: "text-rose-600 dark:text-rose-400",
  paused: "text-muted-foreground",
}

const DOT: Record<NodeStatus, string> = {
  live: "bg-indigo-500",
  optional: "bg-amber-500",
  aptos: "bg-emerald-500",
  planned: "bg-rose-500",
  paused: "bg-muted-foreground/40",
}

const CHIP: Record<NodeStatus, string> = {
  live: "border-indigo-500/25 bg-indigo-500/5",
  optional: "border-amber-500/30 bg-amber-500/5",
  aptos: "border-emerald-500/30 bg-emerald-500/5",
  planned: "border-rose-500/30 bg-rose-500/5",
  paused: "border-border bg-muted/40",
}

/** Short labels for the overview strip, so the whole shape fits on one line. */
const SHORT: Record<string, string> = {
  surfaces: "Surfaces",
  ingress: "Gates",
  context: "Context",
  intelligence: "Investigate",
  verification: "Verify",
  record: "Record",
  human: "Handover",
  governance: "Governance",
  insight: "Insight",
}

/**
 * The whole stack, read top to bottom in the order a question travels.
 *
 * Laid out on a spine rather than as a grid of cards: the point of the page is
 * that these stages are SEQUENTIAL, and a grid says the opposite. The strip at
 * the top exists so the shape is legible before any of the detail is.
 *
 * Colour encodes state, never importance. Anything not indigo is not simply
 * live, which is the same standard the product applies to its own answers.
 */
export function ArchitectureMap() {
  return (
    <div className="space-y-10">
      {/* At a glance: the whole pipeline before any detail. */}
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          A question, end to end
        </p>
        <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
          {STACK.map((layer, i) => (
            <span key={layer.id} className="flex items-center gap-1">
              <a
                href={`#${layer.id}`}
                className="rounded-md border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:border-indigo-500/50 hover:text-indigo-500"
              >
                {SHORT[layer.id] ?? layer.title}
              </a>
              {i < STACK.length - 1 && (
                <span className="text-muted-foreground/40" aria-hidden="true">
                  →
                </span>
              )}
            </span>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-border pt-3">
          {(Object.keys(DOT) as NodeStatus[]).map(s => (
            <span key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", DOT[s])} />
              {STATUS_LABEL[s]}
            </span>
          ))}
        </div>
      </div>

      {/* The spine. A continuous rule down the left says "sequence" in a way
          that a grid of equal cards never can. */}
      <div className="relative">
        <div
          className="absolute bottom-6 left-[15px] top-3 w-px bg-gradient-to-b from-indigo-500/40 via-border to-transparent"
          aria-hidden="true"
        />

        <div className="space-y-10">
          {STACK.map((layer, i) => (
            <section key={layer.id} id={layer.id} className="relative scroll-mt-6 pl-12">
              <span
                className="absolute left-0 top-0 flex size-8 items-center justify-center rounded-full border border-border bg-card font-mono text-xs text-muted-foreground"
                aria-hidden="true"
              >
                {String(i + 1).padStart(2, "0")}
              </span>

              <h2 className="text-lg font-semibold tracking-tight">{layer.title}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {layer.purpose}
              </p>

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {layer.nodes.map(n => (
                  <div
                    key={n.name}
                    className={cn("rounded-lg border p-3 transition-colors", CHIP[n.status])}
                  >
                    <p className="flex items-start gap-2 text-[13px] font-medium leading-snug">
                      <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", DOT[n.status])} />
                      <span className="flex-1">{n.name}</span>
                      {n.status !== "live" && (
                        <span
                          className={cn(
                            "shrink-0 text-[10px] font-semibold uppercase tracking-wide",
                            ACCENT[n.status],
                          )}
                        >
                          {STATUS_LABEL[n.status]}
                        </span>
                      )}
                    </p>
                    <p className="mt-1.5 pl-3.5 text-xs leading-relaxed text-muted-foreground">
                      {n.detail}
                    </p>
                    {n.where && (
                      <p className="mt-2 break-all pl-3.5 font-mono text-[10px] text-muted-foreground/50">
                        {n.where}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Runs on its own
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">Scheduled work</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Driven from <span className="font-mono text-xs">.github/workflows/cron.yml</span> rather
          than Vercel Cron, because the Hobby plan allows one run per day and a retry worker needs
          minutes.
        </p>
        <div className="mt-4 space-y-2">
          {SCHEDULED.map(j => (
            <div
              key={j.path}
              className="grid gap-1 rounded-lg border border-border p-3 sm:grid-cols-[1fr_auto] sm:items-baseline sm:gap-4"
            >
              <div>
                <p className="font-mono text-xs text-indigo-500 dark:text-indigo-400">{j.path}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{j.what}</p>
              </div>
              <span className="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                {j.cadence}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-rose-500/25 bg-rose-500/[0.03] p-5">
        <p className="font-mono text-[11px] uppercase tracking-widest text-rose-600 dark:text-rose-400">
          Stated plainly
        </p>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">What is not built</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The same honesty the record is for. These are the things a buyer would reasonably assume
          exist and would be wrong.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {HONEST_GAPS.map(g => (
            <div key={g.title} className="rounded-lg border border-border bg-background p-3">
              <p className="text-[13px] font-medium">{g.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{g.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
