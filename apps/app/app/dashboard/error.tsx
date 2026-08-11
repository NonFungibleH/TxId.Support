"use client"

import { useEffect } from "react"
import { AlertTriangle } from "lucide-react"

/**
 * Dashboard-wide error boundary. Without one, any uncaught server error (a
 * Supabase blip, the deliberately-thrown org-mismatch guard) dead-ended a
 * paying customer on Next's unstyled "Application error" screen. This keeps
 * them inside the product with a retry and a way to reach us.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Server-side details are already in the server logs; this client log
    // just ties the digest to the session for support.
    console.error("[dashboard]", error.digest ?? error.message)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-amber-500/10">
          <AlertTriangle className="size-6 text-amber-500" />
        </div>
        <h2 className="mb-2 text-lg font-semibold">Something went wrong</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The page hit an unexpected error. Your data is safe. Try again, and if it
          keeps happening, email us{error.digest ? ` and mention code ${error.digest}` : ""}.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Try again
          </button>
          <a
            href={`mailto:team@txid.support?subject=Dashboard%20error${error.digest ? `%20${error.digest}` : ""}`}
            className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Email support
          </a>
        </div>
      </div>
    </div>
  )
}
