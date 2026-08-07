"use client"

import { useEffect, useRef } from "react"
import { useAuth } from "@clerk/nextjs"

/**
 * Force a real page load when the active organisation changes.
 *
 * THE BUG THIS FIXES: switching company left the previous company's data on
 * screen. Clerk's switcher navigates client-side, and Next's router cache
 * serves the RSC payload it already has for that route, so the server never
 * re-runs `auth()` and `getProject()` keeps resolving the OLD org. The tenancy
 * boundary was never breached, but a dashboard showing another company's
 * conversations is indistinguishable from one that was.
 *
 * A soft navigation cannot fix this, because the stale payload IS the cache
 * hit. Only a document load guarantees the server sees the new session.
 *
 * NO RELOAD LOOP: the target org id is written to sessionStorage before
 * reloading, so if the server still disagrees afterwards (a genuinely stuck
 * session rather than a stale cache) it gives up rather than reloading
 * forever. Cleared once the two agree.
 */
export function OrgSyncGuard({ serverOrgId }: { serverOrgId: string | null }) {
  const { isLoaded, orgId } = useAuth()
  const key = "txid_org_sync"
  const done = useRef(false)

  useEffect(() => {
    if (!isLoaded || done.current) return
    const client = orgId ?? null

    if (client === serverOrgId) {
      try { sessionStorage.removeItem(key) } catch { /* ignore */ }
      return
    }

    // Already tried to reload for this exact org and the server still has the
    // old one. Reloading again would just spin.
    try {
      if (sessionStorage.getItem(key) === String(client)) return
      sessionStorage.setItem(key, String(client))
    } catch {
      // No sessionStorage means no loop guard, so do not risk the loop.
      return
    }

    done.current = true
    window.location.reload()
  }, [isLoaded, orgId, serverOrgId])

  return null
}
