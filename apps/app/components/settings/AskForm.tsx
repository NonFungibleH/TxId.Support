"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { updateConfig } from "@/lib/actions/project"
import { Button } from "@/components/ui/button"

export function AskForm({ projectId, initial }: { projectId: string; initial: string }) {
  const [text, setText] = useState(initial)
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { tokenModeAsk: text.trim() || null })
        toast.success("FAQ saved")
      } catch {
        toast.error("Failed to save")
      }
    })
  }

  return (
    <div className="space-y-3">
      <textarea
        rows={12}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Q: Where can I buy the token?\nA: Buy on Uniswap at https://...\n\nQ: What is the total supply?\nA: 100,000,000 tokens"}
        maxLength={2000}
        className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono leading-relaxed outline-none placeholder:text-muted-foreground focus:border-ring"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{text.length} / 2,000</span>
        <Button onClick={save} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  )
}
