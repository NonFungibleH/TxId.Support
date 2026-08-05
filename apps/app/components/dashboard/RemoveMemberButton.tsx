"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { UserMinus } from "lucide-react"
import { removeMember } from "@/lib/actions/team"

/**
 * Take someone's access away.
 *
 * Two-step rather than a confirm dialog: it is a rare action and a
 * consequential one, and a second deliberate click is enough friction without
 * being a modal nobody reads.
 */
export function RemoveMemberButton({
  userId,
  email,
  isSelf,
}: {
  userId: string | null
  email: string
  isSelf: boolean
}) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [, startTransition] = useTransition()

  if (!userId || isSelf) return null

  const go = () => {
    if (!armed) { setArmed(true); return }
    setBusy(true)
    startTransition(async () => {
      try { await removeMember(userId); toast.success(`${email} removed`) }
      catch (err) { toast.error(err instanceof Error ? err.message : "Could not remove") }
      finally { setBusy(false); setArmed(false) }
    })
  }

  return (
    <button
      onClick={go}
      onBlur={() => setArmed(false)}
      disabled={busy}
      title={`Remove ${email} from this organisation`}
      className={`shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
        armed
          ? "border-destructive/50 bg-destructive/10 text-destructive"
          : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      {armed ? "Confirm?" : <UserMinus className="size-3.5" />}
    </button>
  )
}
