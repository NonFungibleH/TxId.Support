"use client"

import { useState, useTransition, useMemo } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Trash2, Plus, ChevronDown } from "lucide-react"
import { upsertGlossaryEntry, removeGlossaryEntry } from "@/lib/actions/contracts"
import type { WatchedContract, ErrorGlossaryEntry } from "@/lib/types/config"

interface Props {
  projectId: string
  contract: WatchedContract
}

/** Inline row for an ABI-detected error that hasn't been explained yet */
function AbiErrorSuggestion({
  projectId,
  contractId,
  errorName,
}: {
  projectId: string
  contractId: string
  errorName: string
}) {
  const [open, setOpen] = useState(false)
  const [explanation, setExplanation] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!explanation.trim()) return
    startTransition(async () => {
      try {
        await upsertGlossaryEntry(projectId, contractId, {
          error: errorName,
          explanation: explanation.trim(),
        })
        toast.success("Explanation saved")
        setOpen(false)
        setExplanation("")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  return (
    <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <Badge variant="outline" className="font-mono text-[10px] shrink-0">{errorName}</Badge>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          Add explanation
          <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5 space-y-2 bg-muted/10">
          <p className="text-xs text-muted-foreground">What should users see when they hit this error?</p>
          <Textarea
            autoFocus
            placeholder={`e.g. "You don't have enough tokens approved — go to the token contract and approve more before trying again."`}
            value={explanation}
            onChange={e => setExplanation(e.target.value)}
            className="text-xs min-h-[60px] resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleSave}
              disabled={isPending || !explanation.trim()}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setOpen(false); setExplanation("") }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function ErrorGlossaryManager({ projectId, contract }: Props) {
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [errorName, setErrorName] = useState("")
  const [explanation, setExplanation] = useState("")

  const entries = contract.errorGlossary ?? []

  // Parse custom errors from the ABI if one is stored
  const abiErrors = useMemo<string[]>(() => {
    if (!contract.abi) return []
    try {
      const abi = JSON.parse(contract.abi) as Array<{ type: string; name?: string }>
      return abi.filter(e => e.type === "error" && e.name).map(e => e.name!)
    } catch {
      return []
    }
  }, [contract.abi])

  const explained = new Set(entries.map(e => e.error))
  const unexplained = abiErrors.filter(name => !explained.has(name))

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

      {/* Already-explained entries */}
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

      {/* ABI-detected errors without explanations */}
      {unexplained.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {unexplained.length} error{unexplained.length !== 1 ? "s" : ""} detected from ABI — add plain-English explanations so users get clear messages:
          </p>
          {unexplained.map(name => (
            <AbiErrorSuggestion
              key={name}
              projectId={projectId}
              contractId={contract.id}
              errorName={name}
            />
          ))}
        </div>
      )}

      {/* Manual add form — always available */}
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
          {abiErrors.length > 0 ? "Add custom error" : "Add error explanation"}
        </Button>
      )}
    </div>
  )
}
