"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setProjectPublicDemo } from "@/lib/actions/admin"
import { cn } from "@/lib/utils"

// Toggles projects.config.publicDemo. When on, this project powers the public
// /check + /demo pages and the marketing-site widget without needing the demo
// key env var mirrored onto the API deployment, and independent of its plan.
export function PublicDemoToggle({ projectId, initial }: { projectId: string; initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, startTransition] = useTransition()

  return (
    <button
      type="button"
      disabled={pending}
      aria-pressed={on}
      title="Public demo: exempt from domain allowlist + enable /check protocol scoping"
      onClick={() => {
        const next = !on
        const prev = on
        setOn(next)
        startTransition(async () => {
          try {
            await setProjectPublicDemo(projectId, next)
            toast.success(next ? "Public demo enabled" : "Public demo disabled")
          } catch (err) {
            setOn(prev)
            toast.error(err instanceof Error ? err.message : "Failed to update")
          }
        })
      }}
      className={cn(
        "rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50",
        on
          ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {on ? "Demo ✓" : "Demo"}
    </button>
  )
}
