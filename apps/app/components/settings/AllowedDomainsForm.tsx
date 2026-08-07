"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { X, Plus, ShieldAlert, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setAllowedDomains } from "@/lib/actions/domains"

/**
 * WHO MAY USE THIS KEY.
 *
 * Loud when empty, deliberately. A publishable key is in plain HTML on the
 * customer's own page, so an unrestricted key is a spend primitive anyone can
 * copy. The list was unsettable until now, so every project reads as empty and
 * every project needs this prompt.
 */
export function AllowedDomainsForm({ initial }: { initial: string[] }) {
  const [domains, setDomains] = useState<string[]>(initial)
  const [draft, setDraft] = useState("")
  const [isPending, startTransition] = useTransition()

  function save(next: string[]) {
    const prev = domains
    setDomains(next)
    startTransition(async () => {
      try {
        const { saved } = await setAllowedDomains(next)
        setDomains(saved)
        if (next.length && saved.length < next.length) {
          toast.error("Some entries were not valid domains and were dropped")
        } else {
          toast.success(saved.length ? "Domains saved" : "Restriction removed")
        }
      } catch (err) {
        setDomains(prev)
        toast.error(err instanceof Error ? err.message : "Could not save")
      }
    })
  }

  function add() {
    if (!draft.trim()) return
    save([...domains, draft])
    setDraft("")
  }

  return (
    <div className="space-y-4">
      {domains.length === 0 ? (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
          <div className="space-y-1">
            <p className="text-sm font-medium">This key works from any website</p>
            <p className="text-xs text-muted-foreground">
              Your publishable key is visible in your page source, which is normal. Until you list
              your domains, anyone who copies it can run the assistant from their own site and it
              counts against your usage. Add the domains you embed on before you go live.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
          <p className="text-sm">
            Your key only works on {domains.length === 1 ? "this domain" : "these domains"}. Requests
            from anywhere else are refused.
          </p>
        </div>
      )}

      {domains.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {domains.map(d => (
            <span
              key={d}
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium"
            >
              {d}
              <button
                onClick={() => save(domains.filter(x => x !== d))}
                disabled={isPending}
                aria-label={`Remove ${d}`}
                className="text-muted-foreground transition-colors hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          placeholder="app.yourprotocol.com"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add() } }}
          className="max-w-sm"
        />
        <Button variant="outline" size="sm" onClick={add} disabled={isPending || !draft.trim()} className="gap-1.5">
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Hostname only, no https:// or paths. Subdomains are separate entries. localhost always
        works, so your developers can test without adding anything.
      </p>
    </div>
  )
}
