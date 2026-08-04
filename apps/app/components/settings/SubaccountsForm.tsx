"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
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
        toast.success(next ? "Subaccounts on" : "Subaccounts off")
      } catch {
        setOn(!next)
        toast.error("Could not save")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <Label htmlFor="subaccounts" className="text-sm font-medium">
            Show users their sub account
          </Label>
          <p className="max-w-xl text-xs text-muted-foreground">
            When your protocol holds each user&apos;s funds in a sub account rather than in their
            wallet, the widget resolves it as soon as they connect and shows both addresses,
            labelled, with the full form available to copy. Without this, users meet the second
            address for the first time inside an answer, and it reads as a hijack.
          </p>
        </div>
        <Switch id="subaccounts" checked={on} onCheckedChange={toggle} />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        {detected ? (
          <p className="text-xs">
            <span className="font-semibold">Ready.</span>{" "}
            <span className="text-muted-foreground">
              Your watched contracts use sub accounts, so each user&apos;s own account resolves when
              they connect. Yours are called{" "}
              <span className="font-medium text-foreground">{detected.label}s</span>, and that is
              the word the widget and the assistant will use.
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Your watched contracts do not use sub accounts, so there is nothing to resolve yet.
            Support is added per protocol: get in touch if yours holds user funds in a separate
            account object.
          </p>
        )}
      </div>
    </div>
  )
}
