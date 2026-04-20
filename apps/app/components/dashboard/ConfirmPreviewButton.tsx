"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { confirmPreview } from "@/lib/actions/project"
import { CheckCircle2, Sparkles } from "lucide-react"

interface ConfirmPreviewButtonProps {
  projectId: string
  confirmed: boolean
}

export function ConfirmPreviewButton({ projectId, confirmed }: ConfirmPreviewButtonProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  if (confirmed) {
    return (
      <div className="flex items-center gap-2 text-green-500 text-sm font-medium shrink-0">
        <CheckCircle2 className="size-4" />
        Confirmed
      </div>
    )
  }

  function handleConfirm() {
    startTransition(async () => {
      try {
        await confirmPreview(projectId)
        toast.success("Looking great! Head to Embed & Go Live to publish.")
        router.push("/dashboard/embed")
      } catch {
        toast.error("Something went wrong — please try again.")
      }
    })
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={isPending}
      className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <Sparkles className="size-4" />
      {isPending ? "Saving…" : "Design looks great!"}
    </button>
  )
}
