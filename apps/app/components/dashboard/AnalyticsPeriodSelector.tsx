"use client"

import { useRouter } from "next/navigation"

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "14d", days: 14 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
]

export function AnalyticsPeriodSelector({ current }: { current: number }) {
  const router = useRouter()

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border p-1">
      {PERIODS.map(({ label, days }) => (
        <button
          key={days}
          onClick={() => router.push(`/dashboard/analytics?days=${days}`)}
          className={[
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            current === days
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          ].join(" ")}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
