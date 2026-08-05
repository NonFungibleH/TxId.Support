"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Megaphone, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { setStatusNotice, clearStatusNotice } from "@/lib/actions/status-notice"
import {
  INCIDENT_LEVEL_LABEL,
  INCIDENT_LEVEL_HELP,
  type IncidentConfig,
  type IncidentLevel,
} from "@/lib/types/config"

const LEVELS: IncidentLevel[] = ["notice", "restricted", "announcement_only"]

function when(iso: string | null | undefined): string {
  if (!iso) return "no expiry set"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return "no expiry set"
  const mins = Math.round((d.getTime() - Date.now()) / 60_000)
  if (mins <= 0) return "expired"
  if (mins < 60) return `clears in ${mins} min`
  return `clears in ${Math.round(mins / 60)} h`
}

/**
 * Tell your users something about your protocol, through the assistant.
 *
 * FRAMING: this is the protocol's own announcement channel, not an emergency
 * switch for TxID. Every string here says "your". Nothing implies the
 * assistant is broken.
 */
export function StatusNoticeControl({ active }: { active: IncidentConfig | null }) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState<IncidentLevel>("restricted")
  const [message, setMessage] = useState("")
  const [topics, setTopics] = useState("")
  const [hours, setHours] = useState(4)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  const run = (fn: () => Promise<void>, ok: string) => {
    setBusy(true)
    startTransition(async () => {
      try { await fn(); toast.success(ok); setOpen(false); setMessage(""); setTopics("") }
      catch (err) { toast.error(err instanceof Error ? err.message : "Could not save") }
      finally { setBusy(false) }
    })
  }

  if (active) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Megaphone className="size-4 text-amber-600" />
              Your service update is live
            </p>
            <p className="text-sm">{active.message}</p>
            <p className="text-xs text-muted-foreground">
              {INCIDENT_LEVEL_LABEL[active.level]}
              {active.topics?.length ? ` · ${active.topics.join(", ")}` : " · everything"}
              {" · "}
              {when(active.expiresAt)}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => run(clearStatusNotice, "Update taken down")}
          >
            <X className="mr-1.5 size-3.5" />
            Take it down
          </Button>
        </div>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border px-4 py-3 text-left transition-colors hover:border-primary/50"
      >
        <Megaphone className="size-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0">
          <span className="block text-sm font-medium">Post a service update</span>
          <span className="block text-xs text-muted-foreground">
            Something going on with your protocol? Tell your users in your own words, and control
            what the assistant says about it until it is resolved.
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="space-y-1">
        <p className="text-sm font-semibold">Post a service update</p>
        <p className="text-xs text-muted-foreground">
          Your users see this word for word, above the conversation. The assistant treats it as
          more current than your documentation, so it will not answer around it.
        </p>
      </div>

      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        rows={3}
        placeholder="We're investigating an issue affecting withdrawals. Please hold off on withdrawing until we confirm it's resolved."
        className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-ring"
      />

      <div className="space-y-1.5">
        <p className="text-xs font-medium">What should the assistant do?</p>
        {LEVELS.map(l => (
          <label key={l} className="flex cursor-pointer items-start gap-2.5 text-xs">
            <input
              type="radio"
              checked={level === l}
              onChange={() => setLevel(l)}
              className="mt-0.5 accent-primary"
            />
            <span>
              <span className="font-medium">{INCIDENT_LEVEL_LABEL[l]}</span>
              <span className="block text-muted-foreground">{INCIDENT_LEVEL_HELP[l]}</span>
            </span>
          </label>
        ))}
      </div>

      {level === "restricted" && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Which topics are affected?</p>
          <input
            value={topics}
            onChange={e => setTopics(e.target.value)}
            placeholder="withdrawals, the APT market"
            className="w-full rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm outline-none focus:border-ring"
          />
          <p className="text-[11px] text-muted-foreground">
            Comma separated, in your users&apos; words. Naming what is affected is better than
            saying everything is: the assistant keeps helping with the rest.
          </p>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-xs font-medium">Take it down automatically after</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 4, 12, 24].map(h => (
            <button
              key={h}
              type="button"
              onClick={() => setHours(h)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                hours === h
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {h}h
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          You can extend or take it down at any time. It expires by itself so an update never
          quietly outlives the issue, which is what teaches users to ignore them.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          size="sm"
          disabled={busy || !message.trim()}
          onClick={() =>
            run(
              () => setStatusNotice({
                level,
                message,
                topics: topics.split(",").map(t => t.trim()).filter(Boolean),
                expiresInHours: hours,
              }),
              "Update posted",
            )
          }
        >
          Post update
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
