"use client"

import { Suspense } from "react"
import { WidgetApp } from "./WidgetApp"

export default function WidgetPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-zinc-950 text-zinc-400 text-sm">Loading…</div>}>
      <WidgetApp />
    </Suspense>
  )
}
