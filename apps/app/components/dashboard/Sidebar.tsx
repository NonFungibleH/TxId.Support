"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Paintbrush, FileCode2, BookOpen,
  Link2, LayoutList, Code2, BarChart3, Users, Globe, MessageSquare, Eye,
} from "lucide-react"
import { cn } from "@/lib/utils"

const SUPPORT_NAV = [
  { href: "/dashboard",           label: "Overview",        icon: LayoutDashboard },
  { href: "/dashboard/branding",  label: "Branding",        icon: Paintbrush },
  { href: "/dashboard/contracts", label: "Smart Contracts", icon: FileCode2 },
  { href: "/dashboard/docs",      label: "Docs & KB",       icon: BookOpen },
  { href: "/dashboard/chains",    label: "Chains",          icon: Link2 },
  { href: "/dashboard/content",   label: "Content",         icon: LayoutList },
  { href: "/dashboard/preview",   label: "Preview",         icon: Eye },
  { href: "/dashboard/embed",     label: "Embed & Go Live", icon: Code2 },
  { href: "/dashboard/analytics", label: "Analytics",       icon: BarChart3 },
  { href: "/dashboard/team",      label: "Team",            icon: Users },
]

const TOKEN_NAV = [
  { href: "/dashboard",           label: "Overview",        icon: LayoutDashboard },
  { href: "/dashboard/branding",  label: "Branding",        icon: Paintbrush },
  { href: "/dashboard/community", label: "Community",       icon: Globe },
  { href: "/dashboard/ask",       label: "Ask AI",          icon: MessageSquare },
  { href: "/dashboard/preview",   label: "Preview",         icon: Eye },
  { href: "/dashboard/embed",     label: "Embed & Go Live", icon: Code2 },
  { href: "/dashboard/analytics", label: "Analytics",       icon: BarChart3 },
]

export function Sidebar({ mode = "support" }: { mode?: string }) {
  const pathname = usePathname()
  const NAV_ITEMS = mode === "token" ? TOKEN_NAV : SUPPORT_NAV

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-background">
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">TX</span>
        </div>
        <span className="font-semibold text-sm">TxID Support</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/dashboard"
            ? pathname === "/dashboard"
            : (pathname ?? "").startsWith(href)

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">tx-id-support-app.vercel.app</p>
      </div>
    </aside>
  )
}
