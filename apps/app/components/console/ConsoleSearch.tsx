"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

/**
 * Global search, on every Console page: type anything the customer gave you
 * and land on the right entity. Lives in the console layout rather than the
 * shared header so the support product's chrome is untouched.
 */
export function ConsoleSearch({ base }: { base: string }) {
  const [q, setQ] = useState("")
  const router = useRouter()

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (q.trim()) router.push(`${base}/customers?q=${encodeURIComponent(q.trim())}`)
      }}
      className="relative mb-6"
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search a customer, email, wallet, or transaction hash"
        aria-label="Search the console"
        className="w-full rounded-lg border bg-card py-2.5 pl-10 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
      />
    </form>
  )
}
