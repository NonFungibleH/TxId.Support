"use client"

import { useState, useRef, useTransition } from "react"
import { Pencil, Check, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { renameProject } from "@/lib/actions/project"

interface Props {
  projectId: string
  initialName: string
}

export function ProjectNameEditor({ projectId, initialName }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialName)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setValue(initialName)
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function cancel() {
    setValue(initialName)
    setEditing(false)
  }

  function save() {
    if (!value.trim() || value.trim() === initialName) { setEditing(false); return }
    startTransition(async () => {
      try {
        await renameProject(projectId, value.trim())
        toast.success("Project renamed")
        setEditing(false)
      } catch {
        toast.error("Failed to rename project")
      }
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") save()
            if (e.key === "Escape") cancel()
          }}
          maxLength={80}
          className="text-2xl font-bold bg-transparent border-b border-primary outline-none w-auto min-w-0"
          style={{ width: `${Math.max(value.length, 4)}ch` }}
          disabled={isPending}
          autoFocus
        />
        <button
          onClick={save}
          disabled={isPending}
          className="rounded p-1 text-green-500 hover:bg-green-500/10 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
        <button
          onClick={cancel}
          disabled={isPending}
          className="rounded p-1 text-muted-foreground hover:bg-muted transition-colors"
        >
          <X className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 group">
      <h1 className="text-2xl font-bold">{initialName}</h1>
      <button
        onClick={startEdit}
        className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
        title="Rename project"
      >
        <Pencil className="size-3.5" />
      </button>
    </div>
  )
}
