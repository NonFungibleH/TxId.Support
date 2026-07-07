"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ShieldCheck, Trash2, Plus, ExternalLink } from "lucide-react"
import { addAudit, removeAudit } from "@/lib/actions/contracts"
import type { AuditEntry } from "@/lib/types/config"

interface Props {
  projectId: string
  audits: AuditEntry[]
}

export function AuditsManager({ projectId, audits }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [auditor, setAuditor] = useState("")
  const [url, setUrl] = useState("")
  const [date, setDate] = useState("")

  function handleAdd() {
    if (!auditor.trim() || !url.trim()) return
    startTransition(async () => {
      try {
        await addAudit(projectId, { auditor: auditor.trim(), url: url.trim(), date: date.trim() || undefined })
        setAuditor(""); setUrl(""); setDate(""); setShowForm(false)
        toast.success("Audit added")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to add audit")
      }
    })
  }

  function handleRemove(id: string) {
    startTransition(async () => {
      try {
        await removeAudit(projectId, id)
        toast.success("Audit removed")
      } catch {
        toast.error("Failed to remove audit")
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-emerald-500" />
        <h3 className="text-sm font-medium">Audits &amp; security</h3>
      </div>
      <p className="text-xs text-muted-foreground -mt-1">
        List your smart-contract audits. The assistant cites these (with links to the auditor&apos;s report) when users ask &ldquo;is this audited?&rdquo;.
      </p>

      {audits.length > 0 && (
        <div className="space-y-1.5">
          {audits.map((a) => (
            <div key={a.id} className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
              <ShieldCheck className="size-3.5 text-emerald-500 shrink-0" />
              <span className="font-medium">{a.auditor}</span>
              {a.date && <span className="text-muted-foreground">· {a.date}</span>}
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-primary hover:underline ml-1 truncate">
                Report <ExternalLink className="size-2.5 opacity-60" />
              </a>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 ml-auto text-muted-foreground hover:text-destructive shrink-0" onClick={() => handleRemove(a.id)} disabled={isPending}>
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <Input placeholder="Auditor, e.g. Hacken or CertiK" value={auditor} onChange={(e) => setAuditor(e.target.value)} className="text-xs h-8" />
          <Input placeholder="Report URL (https://…)" value={url} onChange={(e) => setUrl(e.target.value)} className="text-xs h-8" />
          <Input placeholder="Date (optional), e.g. 2024-01" value={date} onChange={(e) => setDate(e.target.value)} className="text-xs h-8" />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAdd} disabled={isPending || !auditor.trim() || !url.trim()}>Save</Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setShowForm(false); setAuditor(""); setUrl(""); setDate("") }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowForm(true)}>
          <Plus className="size-3" /> Add audit
        </Button>
      )}
    </div>
  )
}
