"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Check, ArrowRight } from "lucide-react"

/**
 * How a customer becomes a wallet.
 *
 * This is the step the whole Console rests on. An agent has an email address,
 * never a transaction hash, so without this mapping the product degrades to an
 * explorer with better copy. It is presented first among equals for that
 * reason, and the options are ordered by how well they actually hold up rather
 * than by how easy they are to switch on.
 */
const OPTIONS = [
  {
    id: "pushed" as const,
    label: "Send it to us at signup",
    detail: "Your app already knows which wallet belongs to which account. Push that pair when it is created and every lookup works from day one.",
    quality: "Most reliable",
  },
  {
    id: "crm_field" as const,
    label: "Read it from a CRM field",
    detail: "If your support tickets already carry the wallet on a custom field, we can read it from there. Nothing to build, but only as complete as that field is.",
    quality: "No engineering",
  },
  {
    id: "manual" as const,
    label: "Let agents paste it",
    detail: "Works with no setup at all, and puts the work back on the person who has least of the information. Use it to get started, not to stay.",
    quality: "Fallback",
  },
]

export function IdentitySetup() {
  const [choice, setChoice] = useState<(typeof OPTIONS)[number]["id"] | null>("crm_field")
  const [field, setField] = useState("wallet_address")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Connect customers to wallets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your agents search by email. The chain only knows addresses. This is how the two are joined.
        </p>
      </div>

      <div className="space-y-3">
        {OPTIONS.map(o => {
          const active = choice === o.id
          return (
            <button
              key={o.id}
              onClick={() => setChoice(o.id)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{o.label}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{o.quality}</span>
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{o.detail}</span>
                </span>
                {active && <Check className="mt-0.5 size-4 shrink-0 text-primary" />}
              </span>
            </button>
          )
        })}
      </div>

      {choice === "crm_field" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Which field holds the wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="field">Custom field name on the ticket or contact</Label>
            <Input id="field" value={field} onChange={e => setField(e.target.value)} className="max-w-sm font-mono text-sm" />
            <p className="text-xs text-muted-foreground">
              Case sensitive, exactly as it appears in your CRM. If a ticket has no value there, the agent can still paste an address by hand.
            </p>
          </CardContent>
        </Card>
      )}

      {choice === "pushed" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Send us the pair</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">
{`POST /api/v1/identity
Authorization: Bearer sk_live_…

{
  "customer_id": "acct_8812",
  "email": "m.reinholt@northwind.example",
  "wallet": "0x8cf0…acca",
  "chain": "aptos"
}`}
            </pre>
            <p className="mt-3 text-xs text-muted-foreground">
              Call it once when an account links a wallet, and again if they change it. We keep the most recent pair and the history behind it.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Button disabled={!choice}>Save and continue <ArrowRight className="size-4" /></Button>
        <span className="text-xs text-muted-foreground">Not yet wired: this saves nothing while the Console is in development.</span>
      </div>
    </div>
  )
}
