"use client"

import { usePathname } from "next/navigation"
import { Menu, ChevronRight } from "lucide-react"
import { AccountMenu } from "@/components/dashboard/AccountMenu"

const PAGE_LABELS: Record<string, string> = {
  "/dashboard":              "Overview",
  "/dashboard/branding":     "Branding",
  "/dashboard/contracts":    "Smart Contracts",
  "/dashboard/docs":         "Docs & KB",
  "/dashboard/chains":       "Chains",
  "/dashboard/content":      "Content",
  "/dashboard/preview":      "Preview",
  "/dashboard/embed":        "Embed & Go Live",
  "/dashboard/conversations":"Conversations",
  "/dashboard/tickets":      "Tickets",
  "/dashboard/analytics":    "Analytics",
  "/dashboard/team":         "Team",
  "/dashboard/community":    "Community",
  "/dashboard/ask":          "Ask AI",
  "/dashboard/token":        "Token",
  "/dashboard/account":      "Account & Billing",
  "/dashboard/upgrade":      "Upgrade Plan",
}

interface DashboardHeaderProps {
  orgName: string
  onMenuToggle?: () => void
}

export function DashboardHeader({ orgName, onMenuToggle }: DashboardHeaderProps) {
  const pathname = usePathname()
  const pageLabel = PAGE_LABELS[pathname ?? ""] ?? null
  const isOverview = pathname === "/dashboard"

  return (
    <header className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4 md:left-60 md:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMenuToggle}
          className="flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors md:hidden shrink-0"
          aria-label="Toggle navigation"
        >
          <Menu className="size-5" />
        </button>
        {isOverview || !pageLabel ? (
          <p className="text-sm font-medium text-foreground truncate">{orgName}</p>
        ) : (
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm text-muted-foreground hidden sm:block shrink-0">{orgName}</p>
            <ChevronRight className="size-3.5 text-muted-foreground/40 hidden sm:block shrink-0" />
            <p className="text-sm font-medium text-foreground truncate">{pageLabel}</p>
          </div>
        )}
      </div>
      <AccountMenu />
    </header>
  )
}
