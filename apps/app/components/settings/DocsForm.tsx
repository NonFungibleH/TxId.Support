"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateConfig } from "@/lib/actions/project"

interface DocsFormProps {
  projectId: string
  initialDocsUrl: string | null
}

export function DocsForm({ projectId, initialDocsUrl }: DocsFormProps) {
  const [docsUrl, setDocsUrl] = useState(initialDocsUrl ?? "")
  const [isPending, startTransition] = useTransition()

  function save() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { docsUrl: docsUrl.trim() || null })
        toast.success("Docs URL saved — indexing will start shortly")
      } catch {
        toast.error("Failed to save docs URL")
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Label htmlFor="docs-url">Documentation URL</Label>
        <Input
          id="docs-url"
          type="url"
          placeholder="https://docs.yourprotocol.com"
          value={docsUrl}
          onChange={e => setDocsUrl(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          We&apos;ll crawl this URL and index the content so the AI can answer questions from your docs.
        </p>
      </div>
      <Button onClick={save} disabled={isPending}>
        {isPending ? "Saving…" : "Save & index"}
      </Button>
    </div>
  )
}
