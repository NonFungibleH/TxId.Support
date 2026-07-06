"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { setProjectPlan } from "@/lib/actions/admin"
import { PLAN_LABELS } from "@/lib/types/config"
import type { Plan } from "@/lib/types/config"

// Order shown in the dropdown — the plans we actually use up front.
const PLAN_OPTIONS: Plan[] = ["free", "demo", "custom", "enterprise", "pro", "starter"]

export function PlanControl({ projectId, currentPlan }: { projectId: string; currentPlan: Plan }) {
  const [plan, setPlan] = useState<Plan>(currentPlan)
  const [pending, startTransition] = useTransition()

  return (
    <select
      value={plan}
      disabled={pending}
      aria-label="Set plan"
      onChange={(e) => {
        const next = e.target.value as Plan
        const prev = plan
        setPlan(next)
        startTransition(async () => {
          try {
            await setProjectPlan(projectId, next)
            toast.success(`Plan set to ${PLAN_LABELS[next]}`)
          } catch (err) {
            setPlan(prev)
            toast.error(err instanceof Error ? err.message : "Failed to set plan")
          }
        })
      }}
      className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold disabled:opacity-50"
    >
      {PLAN_OPTIONS.map((p) => (
        <option key={p} value={p}>
          {PLAN_LABELS[p]}
        </option>
      ))}
    </select>
  )
}
