"use client"

import { useState } from "react"
import { Sidebar } from "./Sidebar"
import { DashboardHeader } from "./DashboardHeader"
import type { Capability } from "@/lib/roles"

interface MobileShellProps {
  orgName: string
  /** Which product's nav to show. Shell, header, footer and theme are shared. */
  product?: "support" | "console"
  mode: string
  beta?: boolean
  caps?: Capability[]
}

export function MobileShell({ orgName, product, mode, beta = false, caps }: MobileShellProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Sidebar product={product} mode={mode} beta={beta} caps={caps} isOpen={open} onClose={() => setOpen(false)} />
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
