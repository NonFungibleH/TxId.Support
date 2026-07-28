"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"
import { updateConfig } from "@/lib/actions/project"

const MAX_QUESTIONS = 6
const MAX_LENGTH = 80

interface Props {
  projectId: string
  initial: string[]
}

// Curated starter chips for the widget. When at least one is set, the widget
// shows these instead of the AI-generated follow-ups, so a chip can never
// propose a feature the protocol doesn't actually have.
export function SuggestedQuestionsEditor({ projectId, initial }: Props) {
  const [questions, setQuestions] = useState<string[]>(initial.length > 0 ? initial : [""])
  const [isPending, startTransition] = useTransition()

  function update(index: number, value: string) {
    setQuestions(qs => qs.map((q, i) => (i === index ? value.slice(0, MAX_LENGTH) : q)))
  }

  function add() {
    setQuestions(qs => (qs.length >= MAX_QUESTIONS ? qs : [...qs, ""]))
  }

  function remove(index: number) {
    setQuestions(qs => {
      const next = qs.filter((_, i) => i !== index)
      return next.length > 0 ? next : [""]
    })
  }

  function save() {
    const cleaned = questions.map(q => q.trim()).filter(q => q.length > 0)
    startTransition(async () => {
      try {
        await updateConfig(projectId, { suggestedQuestions: cleaned })
        setQuestions(cleaned.length > 0 ? cleaned : [""])
        toast.success(
          cleaned.length > 0
            ? `Saved ${cleaned.length} question${cleaned.length === 1 ? "" : "s"}`
            : "Cleared. The AI will suggest follow-ups again."
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  const filledCount = questions.filter(q => q.trim().length > 0).length

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {questions.map((q, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="w-4 shrink-0 text-center text-xs tabular-nums text-muted-foreground/60">{i + 1}</span>
            <Input
              value={q}
              onChange={e => update(i, e.target.value)}
              placeholder={
                i === 0
                  ? "e.g. Why did my transaction fail?"
                  : i === 1
                    ? "e.g. How do the fees work?"
                    : "Add another question"
              }
              maxLength={MAX_LENGTH}
              className="text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove(i)}
              disabled={isPending}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Remove question"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={add}
          disabled={isPending || questions.length >= MAX_QUESTIONS}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          Add question
        </Button>
        <Button size="sm" onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
        <p className="text-xs text-muted-foreground ml-auto">
          {filledCount > 0
            ? `${filledCount} of ${MAX_QUESTIONS} used. These replace the AI's suggestions.`
            : "None set. The AI suggests its own follow-ups."}
        </p>
      </div>
    </div>
  )
}
