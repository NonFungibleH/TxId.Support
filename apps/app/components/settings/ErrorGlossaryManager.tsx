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

/** Inline expandable row for an ABI-detected error or event that hasn't been labelled yet */
function AbiEntrySuggestion({
  projectId,
  contractId,
  name,
  kind,
}: {
  projectId: string
  contractId: string
  name: string
  kind: "error" | "event"
}) {
  const [open, setOpen] = useState(false)
  const [explanation, setExplanation] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    if (!explanation.trim()) return
    startTransition(async () => {
      try {
        await upsertGlossaryEntry(projectId, contractId, {
          error: name,
          explanation: explanation.trim(),
          kind,
        })
        toast.success("Description saved")
        setOpen(false)
        setExplanation("")
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  const placeholder = kind === "event"
    ? `e.g. "A token lock was successfully created — tokens are now locked until the unlock date."`
    : `e.g. "You don't have enough tokens approved — go to the token contract and approve more before trying again."`

  const prompt = kind === "event"
    ? "What does this event mean in plain English? The AI uses this to explain what happened in a transaction."
    : "What should users see when they hit this error?"

  return (
    <div className="rounded-md border border-border bg-muted/20 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40 transition-colors"
      >
        <Badge variant="outline" className="font-mono text-[10px] shrink-0">{name}</Badge>
        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
          Add description
          <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="border-t border-border px-3 py-2.5 space-y-2 bg-muted/10">
          <p className="text-xs text-muted-foreground">{prompt}</p>
          <Textarea
            autoFocus
            placeholder={placeholder}
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
  const [entryName, setEntryName] = useState("")
  const [explanation, setExplanation] = useState("")

  const entries = contract.errorGlossary ?? []

  const { abiErrors, abiEvents } = useMemo(() => {
    if (!contract.abi) return { abiErrors: [] as string[], abiEvents: [] as string[] }
    try {
      const abi = JSON.parse(contract.abi) as Array<{ type: string; name?: string }>
      return {
        abiErrors: abi.filter(e => e.type === "error" && e.name).map(e => e.name!),
        abiEvents: abi.filter(e => e.type === "event" && e.name).map(e => e.name!),
      }
    } catch {
      return { abiErrors: [] as string[], abiEvents: [] as string[] }
    }
  }, [contract.abi])

  const explained = new Set(entries.map(e => e.error))
  const unexplainedErrors = abiErrors.filter(n => !explained.has(n))
  const unexplainedEvents = abiEvents.filter(n => !explained.has(n))
  const hasAbiEntries = abiErrors.length > 0 || abiEvents.length > 0

  function handleAdd() {
    if (!entryName.trim() || !explanation.trim()) return
    startTransition(async () => {
      try {
        await upsertGlossaryEntry(projectId, contract.id, {
          error: entryName.trim(),
          explanation: explanation.trim(),
        })
        setEntryName("")
        setExplanation("")
        setShowForm(false)
        toast.success("Entry saved")
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
    <div className="mt-3 space-y-3">
      <p className="text-xs font-medium text-muted-foreground">Contract glossary</p>

      {/* Already-labelled entries */}
      {entries.length > 0 && (
        <div className="space-y-1.5">
          {entries.map((entry) => (
            <div
              key={entry.error}
              className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {entry.error}
                  </Badge>
                  {entry.kind === "event" && (
                    <Badge variant="secondary" className="text-[10px]">event</Badge>
                  )}
                </div>
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

      {/* ABI-detected errors */}
      {unexplainedErrors.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {unexplainedErrors.length} custom error{unexplainedErrors.length !== 1 ? "s" : ""} from ABI — describe what users should do when they hit each one:
          </p>
          {unexplainedErrors.map(name => (
            <AbiEntrySuggestion
              key={name}
              projectId={projectId}
              contractId={contract.id}
              name={name}
              kind="error"
            />
          ))}
        </div>
      )}

      {/* ABI-detected events */}
      {unexplainedEvents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {unexplainedEvents.length} event{unexplainedEvents.length !== 1 ? "s" : ""} from ABI — describe what each event means so the AI can explain transaction history:
          </p>
          {unexplainedEvents.map(name => (
            <AbiEntrySuggestion
              key={name}
              projectId={projectId}
              contractId={contract.id}
              name={name}
              kind="event"
            />
          ))}
        </div>
      )}

      {/* Manual add */}
      {showForm ? (
        <div className="space-y-2 rounded-md border border-dashed border-border p-3">
          <Input
            placeholder="Error or event name, e.g. SlippageTooHigh or LockAdded"
            value={entryName}
            onChange={(e) => setEntryName(e.target.value)}
            className="text-xs h-8 font-mono"
          />
          <Textarea
            placeholder="Plain-English description shown to users…"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            className="text-xs min-h-[60px] resize-none"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={handleAdd}
              disabled={isPending || !entryName.trim() || !explanation.trim()}
            >
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => { setShowForm(false); setEntryName(""); setExplanation("") }}
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
          {hasAbiEntries ? "Add manual entry" : "Add entry"}
        </Button>
      )}
    </div>
  )
}
