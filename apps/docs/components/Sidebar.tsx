"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

const NAV = [
  {
    section: "Getting Started",
    items: [
      { label: "Quick Start", href: "/docs/quickstart" },
      { label: "Dashboard Setup", href: "/docs/dashboard" },
    ],
  },
  {
    section: "Integration",
    items: [
      { label: "Embed Options", href: "/docs/embed" },
      { label: "Smart Contracts", href: "/docs/contracts" },
    ],
  },
  {
    section: "Reference",
    items: [
      { label: "API Reference", href: "/docs/api" },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-screen w-56 flex-col border-r border-[#1f1f1f] bg-[#0a0a0a]">
      {/* Logo */}
      <div className="flex h-14 shrink-0 items-center border-b border-[#1f1f1f] px-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded bg-accent text-[10px] font-bold text-white">
            TX
          </div>
          <span className="text-sm font-semibold text-white">TxID Support</span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV.map((group) => (
          <div key={group.section}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-[#71717a]">
              {group.section}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center rounded-md px-2 py-1.5 text-sm transition-colors ${
                        active
                          ? "bg-accent/10 text-accent font-medium"
                          : "text-[#a1a1aa] hover:bg-[#18181b] hover:text-white"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#1f1f1f] px-5 py-3">
        <a
          href="https://app.txid.support"
          className="text-xs text-[#71717a] hover:text-white transition-colors"
        >
          Dashboard →
        </a>
      </div>
    </aside>
  )
}
