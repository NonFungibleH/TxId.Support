"use client"

import { cn } from "@/lib/utils"
import { HOWARD_TODO, type TodoItem, type TodoUrgency } from "@/lib/roadmap"

const URGENCY_LABEL: Record<TodoUrgency, string> = {
  now: "Do now",
  soon: "Soon",
  whenever: "Whenever",
}

const URGENCY_CLASS: Record<TodoUrgency, string> = {
  now: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  soon: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  whenever: "bg-muted text-muted-foreground border-border",
}

const ORDER: TodoUrgency[] = ["now", "soon", "whenever"]

/**
 * The things nobody else can do: they need a login, a Vercel env var, or a
 * conversation with a protocol team.
 *
 * Every item carries WHY it matters and what a pass looks like, because a
 * checklist of bare instructions gets followed without anyone noticing when
 * the result is wrong.
 */
export function TodoPanel({
  done,
  onToggle,
}: {
  done: Record<string, boolean>
  onToggle: (id: string) => void
}) {
  const open = HOWARD_TODO.filter(t => !done[t.id])
  const closed = HOWARD_TODO.filter(t => done[t.id])

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-1.5">
          {open.length} open, {closed.length} done
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Everything here needs you specifically: a dashboard login, an env var on Vercel, or a
          decision. Tick one off and it drops to the bottom.
        </p>
      </div>

      {ORDER.map(urgency => {
        const items = open.filter(t => t.urgency === urgency)
        if (items.length === 0) return null
        return (
          <div key={urgency} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {URGENCY_LABEL[urgency]}
            </p>
            {items.map(item => (
              <TodoCard key={item.id} item={item} done={false} onToggle={onToggle} />
            ))}
          </div>
        )
      })}

      {closed.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Done</p>
          {closed.map(item => (
            <TodoCard key={item.id} item={item} done onToggle={onToggle} />
          ))}
        </div>
      )}

      <p className="text-center text-[11px] text-muted-foreground/60">
        Ticks are saved in this browser only, alongside the roadmap statuses.
      </p>
    </div>
  )
}

function TodoCard({
  item,
  done,
  onToggle,
}: {
  item: TodoItem
  done: boolean
  onToggle: (id: string) => void
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4", done && "opacity-50")}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={done}
          onChange={() => onToggle(item.id)}
          aria-label={`Mark "${item.title}" done`}
          className="mt-1 size-4 shrink-0 cursor-pointer accent-indigo-500"
        />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("text-sm font-semibold", done && "line-through")}>{item.title}</p>
            <span
              className={cn(
                "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                URGENCY_CLASS[item.urgency],
              )}
            >
              {URGENCY_LABEL[item.urgency]}
            </span>
          </div>

          {!done && (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">{item.why}</p>

              <ol className="space-y-1.5">
                {item.steps.map((s, i) => (
                  <li key={s} className="flex gap-2.5 text-xs leading-relaxed">
                    <span className="font-mono text-muted-foreground/70">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>

              {item.expect && (
                <p className="rounded-lg border-l-2 border-emerald-500/50 bg-muted/30 px-3 py-2 text-xs leading-relaxed">
                  <span className="font-semibold">What good looks like: </span>
                  {item.expect}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
