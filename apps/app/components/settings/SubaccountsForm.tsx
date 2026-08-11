"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Layers } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { setSubaccountsEnabled } from "@/lib/actions/subaccounts"

/**
 * Opt in to sub accounts.
 *
 * Deliberately a toggle rather than something inferred: most protocols have no
 * such concept, and showing a user a second address on a protocol that does not
 * have one invents a problem. The status line below tells the team whether
 * turning it on will actually do anything, so the switch is never a guess.
 *
 * COPY RULE: describe the capability, never announce a protocol by name. A
 * customer reads this about their own product, and "Decibel detected" reads
 * like we are talking about somebody else's.
 */
export function SubaccountsForm({
  enabled,
  detected,
}: {
  enabled: boolean
  /**
   * What the matched protocol calls its per-user account, when one of the
   * watched contracts uses them. The protocol NAME is deliberately not shown:
   * a customer is reading about their own product.
   */
  detected: { label: string } | null
}) {
  const [on, setOn] = useState(enabled)
  const [, startTransition] = useTransition()

  const toggle = (next: boolean) => {
    setOn(next)
    startTransition(async () => {
      try {
        await setSubaccountsEnabled(next)
        toast.success(next ? "Users will see their sub account" : "Sub accounts off")
      } catch {
        setOn(!next)
        toast.error("Could not save")
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          {/* Icon inside the Label, not beside it, so the whole row stays the
              switch's click target. Muted rather than coloured: the audit
              shield is green because it asserts something, this only names a
              section. */}
          <Label htmlFor="subaccounts" className="flex items-center gap-2 text-sm font-medium">
            <Layers className="size-4 text-muted-foreground" />
            Sub accounts
          </Label>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {detected ? (
              <>
                Your watched contracts hold each user&apos;s funds in a{" "}
                <span className="font-medium text-foreground">{detected.label}</span> rather than in
                their wallet. Turn this on and the widget resolves it the moment they connect,
                showing both addresses labelled and in full. Without it, users meet the second
                address for the first time inside an answer, where it reads as a hijack.
              </>
            ) : (
              <>
                For protocols that hold each user&apos;s funds in a sub account rather than in their
                wallet, such as a perps or margin venue. This turns on only for protocols TxID has
                sub account support for, and none of your watched contracts has it yet. That does not
                mean yours has none: support is added per protocol. If yours holds user funds in a
                separate account object, get in touch and we will add it.
              </>
            )}
          </p>
        </div>
        <Switch id="subaccounts" checked={on} disabled={!detected} onCheckedChange={toggle} />
      </div>
    </div>
  )
}
