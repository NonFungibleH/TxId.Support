"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { X } from "lucide-react"
import { revokeInvitation } from "@/lib/actions/team"

export function RevokeInviteButton({ invitationId }: { invitationId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          try {
            await revokeInvitation(invitationId)
            toast.success("Invitation revoked")
          } catch {
            toast.error("Failed to revoke invitation")
          }
        })
      }
      className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
    >
      {isPending ? "…" : <X className="size-3.5" />}
    </button>
  )
}
