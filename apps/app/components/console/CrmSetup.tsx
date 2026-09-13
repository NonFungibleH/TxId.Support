"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Check } from "lucide-react"

/**
 * CRM connection.
 *
 * Deliberately NOT the same thing as the support product's integrations, which
 * are escalation targets: somewhere to send an alert. This is two-way. The
 * wallet comes IN from the ticket and the resolution goes back OUT onto it, so
 * a team never keeps a second queue.
 *
 * Ordered by how cheap the integration is for us, which is also the order we
 * can honestly promise them in.
 */
const CRMS = [
  { id: "intercom", name: "Intercom", note: "Server-driven, so nothing to install on your side", status: "First" },
  { id: "zendesk", name: "Zendesk", note: "Largest install base, most procurement-friendly", status: "Next" },
  { id: "hubspot", name: "HubSpot", note: "Once the pattern is proven", status: "Later" },
  { id: "freshdesk", name: "Freshdesk", note: "Once the pattern is proven", status: "Later" },
] as const

export function CrmSetup() {
  const [selected, setSelected] = useState<string | null>("intercom")
  const [writeBack, setWriteBack] = useState(true)
  const [readWallet, setReadWallet] = useState(true)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Answers land on the ticket your team already has open, and the wallet comes back the other way.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {CRMS.map(c => {
          const active = selected === c.id
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`rounded-xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:border-primary/40"}`}
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">{c.name}</span>
                {active ? (
                  <Check className="size-4 shrink-0 text-primary" />
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{c.status}</span>
                )}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">{c.note}</span>
            </button>
          )
        })}
      </div>

      {selected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">What flows between us</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Label htmlFor="wb">Write the resolution onto the ticket</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  The diagnosis and its evidence are added to the case your agent already has open.
                </p>
              </div>
              <Switch id="wb" checked={writeBack} onCheckedChange={setWriteBack} />
            </div>
            <div className="flex items-start justify-between gap-4 border-t pt-4">
              <div>
                <Label htmlFor="rw">Read the wallet from the ticket</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Saves the agent pasting an address. Needs the field you named on the customer identity step.
                </p>
              </div>
              <Switch id="rw" checked={readWallet} onCheckedChange={setReadWallet} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-dashed">
        <CardContent className="pt-6">
          <p className="text-sm">
            <span className="font-medium">Assist, never autonomous.</span>{" "}
            <span className="text-muted-foreground">
              TxID hands your agent an answer to send. It does not reply to your customers on its own, and it does not
              compete with the assistant your CRM already ships, which answers from your documentation and cannot read a chain.
            </span>
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button disabled={!selected}>Connect {selected ? CRMS.find(c => c.id === selected)!.name : ""}</Button>
        <span className="text-xs text-muted-foreground">Not yet wired: connections are in development.</span>
      </div>
    </div>
  )
}
