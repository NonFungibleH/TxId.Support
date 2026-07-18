"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { DashboardHeader } from "./DashboardHeader"

interface MobileShellProps {
  orgName: string
  mode: string
  plan: string
  isAdmin?: boolean
}

export function MobileShell({ orgName, mode, plan, isAdmin = false }: MobileShellProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Sidebar mode={mode} plan={plan} isAdmin={isAdmin} isOpen={open} onClose={() => setOpen(false)} />
      <DashboardHeader orgName={orgName} onMenuToggle={() => setOpen((o) => !o)} />
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}
    </>
  )
}
