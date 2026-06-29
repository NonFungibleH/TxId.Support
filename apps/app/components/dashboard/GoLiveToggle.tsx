"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import { toggleActive } from "@/lib/actions/project"

interface GoLiveToggleProps {
  projectId: string
  isActive: boolean
}

export function GoLiveToggle({ projectId, isActive }: GoLiveToggleProps) {
  const [active, setActive] = useState(isActive)
  const [confirming, setConfirming] = useState(false)
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
        await toggleActive(projectId, next)
        toast.success(next ? "Agent is now live" : "Agent paused")
      } catch {
        setActive(!next)
        toast.error("Failed to update status")
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
      {isPending ? "Updating…" : active ? "Live" : "Not live — click to go live"}
    </button>
  )
}
