"use client"

import { useUser, useClerk } from "@clerk/nextjs"
import { useState, useRef, useEffect } from "react"
import { CircleUser, Settings, LogOut } from "lucide-react"
import Link from "next/link"

export function AccountMenu() {
  const { user } = useUser()
  const { signOut } = useClerk()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  const email = user?.primaryEmailAddress?.emailAddress ?? ""
  const name = user?.fullName ?? email

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Account menu"
        className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/20 transition-colors"
      >
        <CircleUser className="size-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-50 w-56 overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
          {/* Identity */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <CircleUser className="size-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{name}</p>
              {name !== email && (
                <p className="text-[11px] text-muted-foreground truncate">{email}</p>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="py-1">
            <Link
              href="/dashboard/account"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
            >
              <Settings className="size-3.5 shrink-0" />
              Account &amp; Billing
            </Link>
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              onClick={() => signOut({ redirectUrl: "/sign-in" })}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
            >
              <LogOut className="size-3.5 shrink-0" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
