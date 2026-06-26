"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { toggleActive } from "@/lib/actions/project"

interface GoLiveToggleProps {
  projectId: string
  isActive: boolean
}

export function GoLiveToggle({ projectId, isActive }: GoLiveToggleProps) {
  const [active, setActive] = useState(isActive)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    const next = !active
    setActive(next)
    startTransition(async () => {
      try {
        await toggleActive(projectId, next)
        toast.success(next ? "Widget is now live" : "Widget paused")
      } catch {
        setActive(!next) // revert
        toast.error("Failed to update status")
      }
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className="flex items-center gap-2.5 rounded-full border px-4 py-2 text-sm font-medium transition-all disabled:opacity-50"
      style={{
        borderColor: active ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.1)",
        background: active ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
        color: active ? "rgb(34,197,94)" : "rgba(255,255,255,0.5)",
      }}
    >
      <span
        className="h-2 w-2 rounded-full"
        style={{ background: active ? "rgb(34,197,94)" : "rgba(255,255,255,0.3)" }}
      />
      {isPending ? "Updating…" : active ? "Live" : "Not live — click to go live"}
    </button>
  )
}
