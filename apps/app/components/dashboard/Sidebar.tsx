"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Paintbrush, FileCode2, BookOpen,
  Link2, LayoutList, Code2, BarChart3, Globe, MessageSquare, Eye, Ticket, MessagesSquare, ExternalLink,
  Sun, Moon, Zap,
} from "lucide-react"
import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://txid.support"

type NavItem = { href: string; label: string; icon: React.ElementType }
type NavGroup = { label?: string; items: NavItem[] }

const SUPPORT_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/dashboard/branding",  label: "Branding",        icon: Paintbrush },
      { href: "/dashboard/contracts", label: "Smart Contracts",  icon: FileCode2 },
      { href: "/dashboard/docs",      label: "Docs & KB",        icon: BookOpen },
      { href: "/dashboard/chains",    label: "Chains",           icon: Link2 },
      { href: "/dashboard/content",   label: "Content",          icon: LayoutList },
    ],
  },
  {
    label: "Launch",
    items: [
      { href: "/dashboard/preview", label: "Preview",         icon: Eye },
      { href: "/dashboard/embed",   label: "Embed & Go Live", icon: Code2 },
    ],
  },
  {
    label: "Monitor",
    items: [
      { href: "/dashboard/conversations", label: "Conversations", icon: MessagesSquare },
      { href: "/dashboard/tickets",       label: "Tickets",       icon: Ticket },
      { href: "/dashboard/analytics",     label: "Analytics",     icon: BarChart3 },
    ],
  },
]

const TOKEN_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    label: "Setup",
    items: [
      { href: "/dashboard/branding",  label: "Branding",  icon: Paintbrush },
      { href: "/dashboard/community", label: "Community", icon: Globe },
      { href: "/dashboard/ask",       label: "Ask AI",    icon: MessageSquare },
    ],
  },
  {
    label: "Launch",
    items: [
      { href: "/dashboard/preview", label: "Preview",         icon: Eye },
      { href: "/dashboard/embed",   label: "Embed & Go Live", icon: Code2 },
    ],
  },
  {
    label: "Monitor",
    items: [
      { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
]

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  free:       { label: "Free",       cls: "bg-muted text-muted-foreground" },
  starter:    { label: "Starter",    cls: "bg-indigo-500/20 text-indigo-400" },
  pro:        { label: "Pro",        cls: "bg-amber-500/20 text-amber-400" },
  enterprise: { label: "Enterprise", cls: "bg-purple-500/20 text-purple-400" },
  custom:     { label: "Custom",     cls: "bg-emerald-500/20 text-emerald-400" },
}

interface SidebarProps {
  mode?: string
  plan?: string
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ mode = "support", plan = "free", isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const GROUPS = mode === "token" ? TOKEN_GROUPS : SUPPORT_GROUPS
  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE.free
  const showUpgrade = plan === "free" || plan === "starter"

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-background transition-transform duration-200",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/txid-icon-64.png" alt="TxID Support" className="h-7 w-7" />
        <span className="font-semibold text-sm">TxID Support</span>
      </div>

      <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-3 gap-4">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                {group.label}
              </p>
            )}
            {group.items.map(({ href, label, icon: Icon }) => {
              const isActive = href === "/dashboard"
                ? pathname === "/dashboard"
                : (pathname ?? "").startsWith(href)

              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute left-0 inset-y-1 w-0.5 bg-primary rounded-r-full" />
                  )}
                  <Icon className="size-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3 space-y-2">
        {/* Plan badge */}
        <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", badge.cls)}>
              {badge.label}
            </span>
            <span className="text-xs text-muted-foreground">plan</span>
          </div>
          {showUpgrade && (
            <Link
              href="/dashboard/upgrade"
              onClick={onClose}
              className="flex items-center gap-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <Zap className="size-3" />
              Upgrade
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors w-full"
        >
          {resolvedTheme === "dark"
            ? <><Sun className="size-3.5 shrink-0" /> Light mode</>
            : <><Moon className="size-3.5 shrink-0" /> Dark mode</>
          }
        </button>
        <p className="text-xs text-muted-foreground px-1">© {new Date().getFullYear()} TxID Support</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1 px-1">
          <a href={`${WEB_URL}/terms`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            Terms <ExternalLink className="size-2.5 opacity-40" />
          </a>
          <a href={`${WEB_URL}/privacy`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
            Privacy <ExternalLink className="size-2.5 opacity-40" />
          </a>
          <a href="mailto:hello@txid.support" className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Contact</a>
        </div>
      </div>
    </aside>
  )
}
