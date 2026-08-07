"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FlaskConical, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { saveBeta } from "@/lib/actions/beta"

/**
 * The way IN to the beta programme, and the reason its tab can be hidden.
 *
 * The tab only appears once a programme exists, which is right (most protocols
 * will never run one and a permanent menu item for it is clutter) but creates
 * an obvious trap: a switch you can only reach after flipping it. This card is
 * the answer. It lives on Overview, which every project sees, and disappears
 * the moment a programme exists, because by then the tab is doing this job.
 *
 * Turning it on here sets sensible defaults and goes straight to the page
 * rather than leaving someone on Overview wondering what changed.
 */
export function BetaStartCard() {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function start() {
    startTransition(async () => {
      try {
        await saveBeta({ enabled: true, autoOpen: true, feedback: true, intro: null, endsAt: null })
        router.push("/dashboard/beta")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not start")
      }
    })
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="size-4 text-muted-foreground" />
            Running a beta or a closed test?
          </p>
          <p className="max-w-xl text-xs text-muted-foreground">
            The assistant can introduce itself to testers when they arrive, answer their questions,
            and collect what they tell you, with the conversation attached to every finding. It keeps
            everything it already does, including live transaction diagnosis.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={start} disabled={isPending} className="shrink-0 gap-1.5">
          {isPending ? "Setting up…" : <>Set up <ArrowRight className="size-3.5" /></>}
        </Button>
      </div>
    </div>
  )
}
