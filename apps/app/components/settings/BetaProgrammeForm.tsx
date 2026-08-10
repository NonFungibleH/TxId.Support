"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { FlaskConical } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { saveBeta, endBeta } from "@/lib/actions/beta"
import { betaControls } from "@/lib/types/config"
import type { BetaConfig } from "@/lib/types/config"

/**
 * Running the assistant for TESTERS instead of users.
 *
 * COPY RULE, same as the sub accounts card: describe the capability, never name
 * another customer. And never call this a "mode" in the interface: it layers on
 * top of everything else rather than replacing it, and a customer who reads
 * "mode" will reasonably expect the assistant to stop doing its normal job.
 */
export function BetaProgrammeForm({ initial }: { initial?: BetaConfig | undefined }) {
  const [beta, setBeta] = useState<BetaConfig>({
    enabled: initial?.enabled === true,
    autoOpen: initial?.autoOpen !== false,
    feedback: initial?.feedback !== false,
    // Undefined inherits feedback, which is what betaControls does everywhere
    // else. A project set up before bug reports existed keeps both on.
    bugReports: initial?.bugReports ?? initial?.feedback !== false,
    intro: initial?.intro ?? null,
    endsAt: initial?.endsAt ?? null,
  })
  const controls = betaControls(beta)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function stop() {
    startTransition(async () => {
      try {
        await endBeta()
        toast.success("Beta programme ended. Findings are kept on Tickets.")
        // Back to Overview, because the tab this page lives under has just
        // gone. Staying here would leave someone on a page with no route to it.
        router.push("/dashboard")
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not end the programme")
      }
    })
  }

  // Expiry is resolved on read, so the form has to say so itself: a programme
  // that has already ended still shows its settings, and without this the page
  // would claim it is running.
  const ended =
    !!beta.endsAt && Number.isFinite(Date.parse(beta.endsAt)) && Date.parse(beta.endsAt) <= Date.now()

  function persist(next: BetaConfig) {
    const prev = beta
    setBeta(next)
    startTransition(async () => {
      try {
        await saveBeta(next)
      } catch (err) {
        setBeta(prev)
        toast.error(err instanceof Error ? err.message : "Could not save")
      }
    })
  }

  // NO INNER BORDER OR HEADING: the card around this supplies both, and
  // repeating them made the master switch look like a sub-setting of
  // something else.
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <Label htmlFor="beta" className="flex items-center gap-2 text-sm font-medium">
            <FlaskConical className="size-4 text-muted-foreground" />
            Run a beta programme
          </Label>
          <p className="max-w-xl text-xs text-muted-foreground">
            Everything the assistant already does keeps working, including live transaction
            diagnosis. Nothing else about your setup changes, and it stops on its own if you set an
            end date.
          </p>
        </div>
        <Switch
          id="beta"
          checked={beta.enabled}
          onCheckedChange={v => persist({ ...beta, enabled: v })}
        />
      </div>

      {beta.enabled && (
        <div className="space-y-4 border-t border-border pt-4">
          {ended && (
            <p className="text-xs text-amber-600">
              The end date has passed, so the assistant is already behaving normally again. Clear or
              extend the date to start it up.
            </p>
          )}

          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <Label htmlFor="beta-open" className="text-sm font-medium">Introduce itself on arrival</Label>
              <p className="max-w-xl text-xs text-muted-foreground">
                Opens once per visit, on desktop only, and never if the tester has already opened it.
                A tester who has just landed does not know what they are meant to do, and waiting to
                be clicked wastes the one moment their attention is guaranteed.
              </p>
            </div>
            <Switch
              id="beta-open"
              checked={beta.autoOpen === true}
              onCheckedChange={v => persist({ ...beta, autoOpen: v })}
            />
          </div>

          {/* TWO SWITCHES, NOT ONE. Feedback and bug reports are different jobs
              with different questions and different queues: a design review
              wants opinions and no bug list, a release hardening wants the
              opposite, and plenty of teams want both. Each one adds its own
              button in the widget and its own instructions to the assistant.
              `bugReports` left undefined inherits `feedback`, so a project set
              up before the split keeps behaving exactly as it did. */}
          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <Label htmlFor="beta-feedback" className="text-sm font-medium">Let testers leave feedback</Label>
              <p className="max-w-xl text-xs text-muted-foreground">
                Adds a Feedback button for opinions, reactions and suggestions. The assistant stops
                trying to solve, asks only what they expected to happen, and records it with the
                conversation attached. It never promises anyone will reply, because you cannot
                answer every tester individually.
              </p>
            </div>
            <Switch
              id="beta-feedback"
              checked={controls.feedback}
              onCheckedChange={v => persist({ ...beta, feedback: v, bugReports: controls.bugs })}
            />
          </div>

          <div className="flex items-start justify-between gap-6">
            <div className="space-y-1">
              <Label htmlFor="beta-bugs" className="text-sm font-medium">Let testers report bugs</Label>
              <p className="max-w-xl text-xs text-muted-foreground">
                Adds a Bug button for things that are broken. The assistant asks what they were
                trying to do and where it went wrong, then stops: it never asks for their browser,
                wallet, network or a transaction hash, because the report already carries all of it.
              </p>
            </div>
            <Switch
              id="beta-bugs"
              checked={controls.bugs}
              onCheckedChange={v => persist({ ...beta, feedback: controls.feedback, bugReports: v })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="beta-intro" className="text-sm font-medium">Introduction</Label>
            <Textarea
              id="beta-intro"
              rows={3}
              maxLength={600}
              placeholder="Welcome to the beta. I can walk you through what to try, and answer anything as you go."
              value={beta.intro ?? ""}
              onChange={e => setBeta({ ...beta, intro: e.target.value || null })}
              onBlur={() => persist(beta)}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground">
              What testers see when it opens itself. Leave blank to use your opening message. The
              tappable starter questions come from Suggested questions above, so set those to the
              things you want every tester to try.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beta-ends" className="text-sm font-medium">End date</Label>
            <div className="flex items-center gap-2">
              <Input
                id="beta-ends"
                type="date"
                value={beta.endsAt ? beta.endsAt.slice(0, 10) : ""}
                onChange={e => persist({ ...beta, endsAt: e.target.value || null })}
                className="max-w-[200px]"
              />
              {beta.endsAt && (
                <Button variant="ghost" size="sm" onClick={() => persist({ ...beta, endsAt: null })}>
                  Clear
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Optional, and worth setting. Betas end, and nothing looks worse than a welcome to the
              beta still greeting people months later. After this date the assistant goes back to
              normal on its own.
            </p>
          </div>

          {/* An explicit way OUT. The switch above does the same thing, but
              someone who set this up by mistake is looking for an exit, not
              for the control they just used pointed the other way. */}
          <div className="flex items-center gap-3 border-t border-border pt-4">
            <Button variant="outline" size="sm" onClick={stop} disabled={isPending}>
              {isPending ? "Ending…" : "End beta programme"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Puts the dashboard back as it was and removes the tab. Findings testers already
              recorded are kept, on the Tickets page.
            </p>
          </div>

          {isPending && <p className="text-xs text-muted-foreground">Saving…</p>}
        </div>
      )}
    </div>
  )
}
