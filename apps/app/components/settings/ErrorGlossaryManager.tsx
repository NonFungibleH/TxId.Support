"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus } from "lucide-react"
import { upsertGlossaryEntry, removeGlossaryEntry } from "@/lib/actions/contracts"
import type { WatchedContract, ErrorGlossaryEntry } from "@/lib/types/config"

interface Props {
  projectId: string
  contract: WatchedContract
}

export function ErrorGlossaryManager({ projectId, contract }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [errorName, setErrorName] = useState("")
  const [explanation, setExplanation] = useState("")

  const entries = contract.errorGlossary ?? []

  function handleAdd() {
    if (!errorName.trim() || !explanation.trim()) return
    startTransition(async () => {
      try {
        await upsertGlossaryEntry(projectId, contract.id, {
          error: errorName.trim(),
          explanation: explanation.trim(),
        })
        setErrorName("")
        setExplanation("")
        setShowForm(false)
        toast.success("Error explanation saved")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  function handleRemove(entry: ErrorGlossaryEntry) {
    startTransition(async () => {
      try {
        await removeGlossaryEntry(projectId, contract.id, entry.error)
        toast.success("Entry removed")
      } catch {
        toast.error("Failed to remove entry")
      }
    })
  }

  return (
    <div className="mt-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Error glossary</p>

      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.error}
              className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
            >
              <div className="flex-1 min-w-0">
                <Badge variant="outline" className="font-mono text-[10px] mb-1">
                  {entry.error}
                </Badge>
                <p className="text-muted-foreground leading-relaxed">{entry.explanation}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                onClick={() => handleRemove(entry)}
                disabled={isPending}
              >
                <Trash2 className="size-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {showForm ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <Input
            placeholder="Error name, e.g. SlippageTooHigh"
            value={errorName}
            onChange={(e) => setErrorName(e.target.value)}
            className="text-xs h-8 font-mono"
          />
          <Textarea
            placeholder="Plain-English explanation shown to users when this error is encountered…"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            className="text-xs min-h-[60px] resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={isPending || !errorName.trim() || !explanation.trim()}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setShowForm(false); setErrorName(""); setExplanation("") }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => setShowForm(true)}
        >
          <Plus className="size-3" />
          Add error explanation
        </Button>
      )}
    </div>
  )
}
