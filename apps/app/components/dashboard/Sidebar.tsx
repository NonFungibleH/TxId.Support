"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Paintbrush, FileCode2, BookOpen,
  LayoutList, Code2, BarChart3, Globe, MessageSquare, MessageCircle, Eye, Ticket, MessagesSquare,
  Send, Wallet, Users, FlaskConical,
} from "lucide-react"
import { cn } from "@/lib/utils"

type NavItem = { href: string; label: string; icon: React.ElementType; beta?: boolean }
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
      { href: "/dashboard/contracts", label: "Smart Contracts",  icon: FileCode2 },
      { href: "/dashboard/docs",      label: "Docs & KB",        icon: BookOpen },
      { href: "/dashboard/branding",  label: "Branding",         icon: Paintbrush },
      { href: "/dashboard/persona",   label: "Persona",          icon: MessageCircle },
      { href: "/dashboard/beta",      label: "Beta programme",   icon: FlaskConical },
      { href: "/dashboard/content",   label: "Content",          icon: LayoutList },
    ],
  },
  {
    label: "Launch",
    items: [
      { href: "/dashboard/preview",  label: "Preview",         icon: Eye },
      { href: "/dashboard/embed",    label: "Embed & Go Live", icon: Code2 },
      { href: "/dashboard/telegram", label: "Telegram",        icon: Send },
    ],
  },
  {
    label: "Monitor",
    items: [
      { href: "/dashboard/conversations", label: "Conversations", icon: MessagesSquare },
      { href: "/dashboard/findings",      label: "Bugs & Feedback", icon: FlaskConical },
      { href: "/dashboard/tickets",       label: "Tickets",       icon: Ticket },
      { href: "/dashboard/analytics",     label: "Analytics",     icon: BarChart3 },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/dashboard/team", label: "Team & access", icon: Users },
    ],
  },
  {
    label: "Beta",
    items: [
      { href: "/dashboard/actions", label: "Actions", icon: Wallet, beta: true },
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


interface SidebarProps {
  mode?: string
  /** A beta programme is configured. Reveals its tab; hidden otherwise. */
  beta?: boolean
  isOpen?: boolean
  onClose?: () => void
}

export function Sidebar({ mode = "support", beta = false, isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname()
  // The Beta programme tab appears only once one is set up, so the menu is not
  // carrying a feature most protocols will never use. It is NOT how you turn
  // it on: that would be a switch you can only reach after flipping it. The
  // choice lives on Overview, which every project sees.
  const base = mode === "token" ? TOKEN_GROUPS : SUPPORT_GROUPS
  const GROUPS = beta
    ? base
    : base.map(g => ({ ...g, items: g.items.filter(i => i.href !== "/dashboard/beta") }))

  return (
    <aside
      className={[
        "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-background transition-transform duration-200",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
      ].join(" ")}
    >
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/txid-icon-64.png" alt="TxID" className="h-7 w-7" />
        <span className="font-semibold text-sm">TxID</span>
      </div>

      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-3 pb-14">
        {GROUPS.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label && (
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                {group.label}
              </p>
            )}
            {group.items.map(({ href, label, icon: Icon, beta }) => {
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
                  {beta && (
                    <span className="ml-auto rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-400">
                      Beta
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

    </aside>
  )
}
