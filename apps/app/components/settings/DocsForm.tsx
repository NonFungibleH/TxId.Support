"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, Trash2 } from "lucide-react"
import { updateConfig } from "@/lib/actions/project"
import { ingestText, clearKnowledgeBase } from "@/lib/actions/ingest"

interface DocsFormProps {
  projectId: string
  initialDocsUrl: string | null
  docCount: number
}

export function DocsForm({ projectId, initialDocsUrl, docCount }: DocsFormProps) {
  const [docsUrl, setDocsUrl] = useState(initialDocsUrl ?? "")
  const [content, setContent] = useState("")
  const [sourceUrl, setSourceUrl] = useState("")
  const [currentDocCount, setCurrentDocCount] = useState(docCount)
  const [isPending, startTransition] = useTransition()
  const [lastResult, setLastResult] = useState<string | null>(null)

  function saveUrl() {
    startTransition(async () => {
      try {
        await updateConfig(projectId, { docsUrl: docsUrl.trim() || null })
        toast.success("Docs URL saved")
      } catch {
        toast.error("Failed to save URL")
      }
    })
  }

  function ingest() {
    if (!content.trim()) { toast.error("Paste some content first"); return }
    startTransition(async () => {
      setLastResult(null)
      const result = await ingestText(projectId, content, sourceUrl.trim() || undefined)
      if (result.ok && result.chunksInserted) {
        toast.success(`Indexed ${result.chunksInserted} chunks`)
        setLastResult(`${result.chunksInserted} chunks indexed`)
        setCurrentDocCount((n) => n + result.chunksInserted!)
        setContent("")
        setSourceUrl("")
      } else {
        toast.error(result.error ?? "Ingestion failed")
      }
    })
  }

  function clear() {
    startTransition(async () => {
      const result = await clearKnowledgeBase(projectId)
      if (result.ok) {
        toast.success("Knowledge base cleared")
        setCurrentDocCount(0)
      } else {
        toast.error(result.error ?? "Failed")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Knowledge base:</span>
        <Badge variant={currentDocCount > 0 ? "default" : "secondary"}>
          {currentDocCount} chunk{currentDocCount !== 1 ? "s" : ""} indexed
        </Badge>
        {currentDocCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={clear}
            disabled={isPending}
          >
            <Trash2 className="size-3" />
            Clear all
          </Button>
        )}
      </div>

      <Tabs defaultValue="paste">
        <TabsList className="grid grid-cols-2 w-full max-w-xs">
          <TabsTrigger value="paste">Paste content</TabsTrigger>
          <TabsTrigger value="url">Docs URL</TabsTrigger>
        </TabsList>

        <TabsContent value="paste" className="mt-4 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="paste-content">Content to index</Label>
            <textarea
              id="paste-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Paste your protocol docs, FAQ, whitepaper, or any text you want the AI to know about…"
              rows={10}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-ring font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Text is chunked, embedded with Voyage AI, and stored for RAG retrieval.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="source-url">
              Source URL <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="source-url"
              type="url"
              placeholder="https://docs.yourprotocol.com/faq"
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Re-submitting the same source URL replaces previous content from that source.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={ingest} disabled={isPending || !content.trim()}>
              {isPending
                ? <><Loader2 className="size-3.5 animate-spin mr-2" />Indexing…</>
                : "Index content"}
            </Button>
            {lastResult && (
              <span className="flex items-center gap-1 text-xs text-green-500">
                <CheckCircle2 className="size-3.5" />
                {lastResult}
              </span>
            )}
          </div>
        </TabsContent>

        <TabsContent value="url" className="mt-4 space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="docs-url">Documentation URL</Label>
            <Input
              id="docs-url"
              type="url"
              placeholder="https://docs.yourprotocol.com"
              value={docsUrl}
              onChange={(e) => setDocsUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Save your docs URL here. Automatic crawling is available in the Pro plan — use
              &ldquo;Paste content&rdquo; to index manually right now.
            </p>
          </div>
          <Button onClick={saveUrl} disabled={isPending}>
            {isPending ? "Saving…" : "Save URL"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  )
}
