"use client"

import { useEffect, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import {
  ROADMAP, PHASES, AREA_LABEL, FRAMING, SHIPPED,
  type RoadmapItem, type RoadmapArea,
} from "@/lib/roadmap"

const STORE_KEY = "txid-roadmap-v1"

// User-settable statuses (a superset of the data-file defaults).
const STATUSES = ["next", "in-progress", "soon", "later", "done", "deferred"] as const
type Status = (typeof STATUSES)[number]
const STATUS_LABEL: Record<Status, string> = {
  next: "Next", "in-progress": "In progress", soon: "Soon", later: "Later", done: "Done", deferred: "Deferred",
}
const STATUS_CLASS: Record<Status, string> = {
  next: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  "in-progress": "bg-amber-500/15 text-amber-400 border-amber-500/30",
  soon: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  later: "bg-muted text-muted-foreground border-border",
  done: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  deferred: "bg-muted text-muted-foreground/60 border-border",
}

const AREA_CLASS: Record<RoadmapArea, string> = {
  foundation: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  knowledge: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  handoff: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  compliance: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
}

const COMPLEXITY_CLASS: Record<string, string> = {
  Low: "text-emerald-400", Medium: "text-amber-400", High: "text-orange-400", "Very High": "text-red-400",
}

interface Store {
  status: Record<string, Status>
  notes: Record<string, string>
  scratch: string
}

const EMPTY: Store = { status: {}, notes: {}, scratch: "" }

export function RoadmapBoard() {
  const [store, setStore] = useState<Store>(EMPTY)
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<RoadmapArea | "all">("all")
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set())

  // Load from localStorage on mount (client-only, avoids hydration mismatch).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY)
      if (raw) setStore({ ...EMPTY, ...(JSON.parse(raw) as Partial<Store>) })
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)) } catch { /* ignore */ }
  }, [store, loaded])

  const statusOf = (item: RoadmapItem): Status => store.status[item.id] ?? (item.status as Status)

  const setStatus = (id: string, s: Status) => setStore((p) => ({ ...p, status: { ...p.status, [id]: s } }))
  const setNote = (id: string, v: string) => setStore((p) => ({ ...p, notes: { ...p.notes, [id]: v } }))
  const toggleNote = (id: string) =>
    setOpenNotes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const items = useMemo(
    () => (filter === "all" ? ROADMAP : ROADMAP.filter((i) => i.area === filter)),
    [filter],
  )
  const focus = useMemo(
    () => ROADMAP.filter((i) => { const s = statusOf(i); return s === "next" || s === "in-progress" }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [store, loaded],
  )

  const areas: (RoadmapArea | "all")[] = ["all", "foundation", "knowledge", "handoff", "compliance"]

  return (
    <div className="space-y-8">
      {/* Framing */}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">The vision</p>
          <p className="text-sm leading-relaxed">{FRAMING.vision}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">The guardrail</p>
          <p className="text-sm leading-relaxed">{FRAMING.constraint}</p>
        </div>
      </div>

      {/* Focus now */}
      <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-400 mb-2">Focus now ({focus.length})</p>
        {focus.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {focus.map((i) => (
              <span key={i.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">
                <span className={cn("size-1.5 rounded-full", statusOf(i) === "in-progress" ? "bg-amber-400" : "bg-indigo-400")} />
                {i.title}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nothing marked Next or In progress. Set an item&apos;s status below.</p>
        )}
      </div>

      {/* Global scratchpad */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Brain dump</p>
          <p className="text-[10px] text-muted-foreground/70">Saved in this browser</p>
        </div>
        <textarea
          value={store.scratch}
          onChange={(e) => setStore((p) => ({ ...p, scratch: e.target.value }))}
          placeholder="Thoughts, ideas, questions to work through…"
          rows={4}
          className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
        />
      </div>

      {/* Area filter */}
      <div className="flex flex-wrap gap-2">
        {areas.map((a) => (
          <button
            key={a}
            onClick={() => setFilter(a)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              filter === a ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-400" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {a === "all" ? "All" : AREA_LABEL[a]}
          </button>
        ))}
      </div>

      {/* Phases */}
      {PHASES.map((ph) => {
        const phaseItems = items.filter((i) => i.phase === ph.phase)
        if (phaseItems.length === 0) return null
        return (
          <div key={ph.phase} className="space-y-3">
            <div>
              <h2 className="text-lg font-bold">{ph.title}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{ph.subtitle}</p>
            </div>
            <div className="space-y-2.5">
              {phaseItems.map((item) => {
                const s = statusOf(item)
                const hasNote = !!store.notes[item.id]
                const noteOpen = openNotes.has(item.id)
                return (
                  <div
                    key={item.id}
                    className={cn("rounded-xl border border-border bg-card p-4", s === "done" && "opacity-60", s === "deferred" && "opacity-70")}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-semibold", AREA_CLASS[item.area])}>
                            {AREA_LABEL[item.area]}
                          </span>
                          <h3 className={cn("text-sm font-semibold", s === "done" && "line-through")}>{item.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{item.what}</p>
                        {item.depends && (
                          <p className="mt-1.5 text-xs text-muted-foreground/80"><span className="font-medium">Dependency:</span> {item.depends}</p>
                        )}
                        {item.care && (
                          <p className="mt-1.5 text-xs text-amber-500/90"><span className="font-medium">⚠ Care:</span> {item.care}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className={cn("text-xs font-semibold", COMPLEXITY_CLASS[item.complexity])}>{item.complexity}</span>
                        <span className="text-[11px] text-muted-foreground tabular-nums">{item.effort}</span>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 border-t border-border pt-2.5">
                      <select
                        value={s}
                        onChange={(e) => setStatus(item.id, e.target.value as Status)}
                        className={cn("rounded-md border px-2 py-1 text-xs font-medium outline-none", STATUS_CLASS[s])}
                      >
                        {STATUSES.map((opt) => <option key={opt} value={opt}>{STATUS_LABEL[opt]}</option>)}
                      </select>
                      <button
                        onClick={() => toggleNote(item.id)}
                        className={cn("rounded-md border px-2 py-1 text-xs transition-colors", hasNote ? "border-indigo-500/30 text-indigo-400" : "border-border text-muted-foreground hover:text-foreground")}
                      >
                        {hasNote ? "● Note" : "＋ Note"}
                      </button>
                    </div>

                    {noteOpen && (
                      <textarea
                        value={store.notes[item.id] ?? ""}
                        onChange={(e) => setNote(item.id, e.target.value)}
                        placeholder="Notes, decisions, links for this item…"
                        rows={3}
                        className="mt-2 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Recently shipped */}
      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-2">Recently shipped</p>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {SHIPPED.map((s) => (
            <li key={s} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400" />{s}
            </li>
          ))}
        </ul>
      </div>

      <p className="text-center text-[11px] text-muted-foreground/60">
        Statuses and notes are saved in this browser only. Ask to upgrade to shared, cross-device persistence when you want the team on it.
      </p>
    </div>
  )
}
