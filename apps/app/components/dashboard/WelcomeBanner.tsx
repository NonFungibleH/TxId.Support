"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"

/**
 * A brief hello on the first dashboard load of a session.
 *
 * ONCE PER SESSION, not once per navigation. A greeting that reappears every
 * time you click a sidebar link stops reading as welcoming and starts reading
 * as a bug, so a sessionStorage flag gates it: a new browser tab or a fresh
 * sign-in shows it again, moving around the product does not.
 *
 * It also holds a slot for something worth saying. An empty pleasantry earns
 * its space once; a pleasantry that also tells you a queue is waiting earns it
 * every time.
 */
const SEEN_KEY = "txid-welcomed"

export function WelcomeBanner({
  name,
  openTickets,
}: {
  name: string | null
  openTickets: number
}) {
  const [show, setShow] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    let seen = true
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1"
      if (!seen) sessionStorage.setItem(SEEN_KEY, "1")
    } catch {
      // Private mode or storage disabled: skip rather than greet on every
      // single page load, which would be worse than not greeting at all.
    }
    if (seen) return

    setShow(true)
    // Long enough to read twice without hurrying, short enough that nobody
    // reaches for the dismiss button.
    const fade = setTimeout(() => setLeaving(true), 10000)
    const hide = setTimeout(() => setShow(false), 10600)
    return () => { clearTimeout(fade); clearTimeout(hide) }
  }, [])

  if (!show) return null

  const first = name?.trim().split(/\s+/)[0]

  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 transition-all duration-500 ${
        leaving ? "-translate-y-1 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {first ? `Welcome back, ${first}.` : "Welcome back."}
        </p>
        <p className="text-xs text-muted-foreground">
          {openTickets > 0
            ? `${openTickets} ticket${openTickets === 1 ? "" : "s"} waiting for someone.`
            : "Nothing waiting on you."}
        </p>
      </div>
      <button
        onClick={() => setLeaving(true)}
        aria-label="Dismiss"
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
