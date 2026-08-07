"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import Link from "next/link"
import { toggleActive } from "@/lib/actions/project"

interface GoLiveToggleProps {
  projectId: string
  isActive: boolean
}

export function GoLiveToggle({ projectId, isActive }: GoLiveToggleProps) {
  const [active, setActive] = useState(isActive)
  const [confirming, setConfirming] = useState(false)
  const [blocked, setBlocked] = useState<{ ok: false; reason: string; fix?: { label: string; href: string } } | null>(null)
  const [isPending, startTransition] = useTransition()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme !== "light"

  function handleClick() {
    if (!active && !confirming) {
      setConfirming(true)
      return
    }
    setConfirming(false)
    const next = !active
    setActive(next)
    startTransition(async () => {
      try {
        const res = await toggleActive(projectId, next)
        if (res.ok) {
          setBlocked(null)
          toast.success(next ? "Agent is now live" : "Agent paused")
          return
        }
        // SAY WHY, AND SAY WHERE. This used to revert the button and toast
        // "Failed to update status", which tells the user nothing they can act
        // on: the reason was written, thrown, redacted by Next.js in
        // production, and then discarded here as well. The refusal is now a
        // returned value and it stays on screen, because a toast disappears
        // before someone has read a sentence and gone looking for the setting.
        setActive(!next)
        setBlocked(res)
      } catch {
        setActive(!next)
        setBlocked({ ok: false, reason: "Something went wrong on our side. Please try again, and tell us if it keeps happening." })
      }
    })
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground hidden sm:block">Publish to all users?</p>
        <button
          type="button"
          onClick={handleClick}
          className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors"
        >
          Yes, go live
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-2">
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
      style={{
        borderColor: active ? "rgba(34,197,94,0.4)" : isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.15)",
        background:  active ? "rgba(34,197,94,0.08)" : isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
        color:       active ? "rgb(34,197,94)" : isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.45)",
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: active ? "rgb(34,197,94)" : isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.25)" }}
      />
      {isPending ? "Updating…" : active ? "Live" : "Not live - click to go live"}
    </button>
    {blocked && (
      <div className="max-w-sm rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-left">
        <p className="text-xs font-medium">Not live yet</p>
        <p className="mt-1 text-xs text-muted-foreground">{blocked.reason}</p>
        {blocked.fix && (
          <Link
            href={blocked.fix.href}
            className="mt-2 inline-block text-xs font-medium text-primary hover:text-primary/80"
          >
            {blocked.fix.label} &rarr;
          </Link>
        )}
      </div>
    )}
    </div>
  )
}
