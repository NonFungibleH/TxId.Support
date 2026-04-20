"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, Trash2, Plus, Globe, FileText, AlertTriangle } from "lucide-react"
import { fetchAndIngest, ingestText, clearKnowledgeBase } from "@/lib/actions/ingest"

interface DocsFormProps {
  projectId: string
  initialDocsUrl: string | null
  docCount: number
  voyageKeySet: boolean
}

export function DocsForm({ projectId, docCount, voyageKeySet }: DocsFormProps) {
  const [url, setUrl] = useState("")
  const [currentDocCount, setCurrentDocCount] = useState(docCount)
  const [isPending, startTransition] = useTransition()
  const [lastResult, setLastResult] = useState<string | null>(null)

  // Manual paste fallback
  const [showPaste, setShowPaste] = useState(false)
  const [pasteContent, setPasteContent] = useState("")
  const [pasteUrl, setPasteUrl] = useState("")

  function fetchUrl() {
    if (!url.trim()) { toast.error("Enter a URL first"); return }
    startTransition(async () => {
      setLastResult(null)
      const result = await fetchAndIngest(projectId, url.trim())
      if (result.ok && result.chunksInserted) {
        toast.success(`Indexed ${result.chunksInserted} chunks from ${url}`)
        setLastResult(`${result.chunksInserted} chunks indexed`)
        setCurrentDocCount(n => n + result.chunksInserted!)
        setUrl("")
      } else {
        toast.error(result.error ?? "Failed to index URL")
      }
    })
  }

  function ingestPaste() {
    if (!pasteContent.trim()) { toast.error("Paste some content first"); return }
    startTransition(async () => {
      setLastResult(null)
      const result = await ingestText(projectId, pasteContent, pasteUrl.trim() || undefined)
      if (result.ok && result.chunksInserted) {
        toast.success(`Indexed ${result.chunksInserted} chunks`)
        setLastResult(`${result.chunksInserted} chunks indexed`)
        setCurrentDocCount(n => n + result.chunksInserted!)
        setPasteContent("")
        setPasteUrl("")
        setShowPaste(false)
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
        setLastResult(null)
      } else {
        toast.error(result.error ?? "Failed")
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Status */}
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

      {/* Voyage key warning */}
      {!voyageKeySet && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="size-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-amber-500">VOYAGE_API_KEY not set</p>
            <p className="text-muted-foreground text-xs mt-0.5">
              Indexing requires a Voyage AI key. Sign up free at{" "}
              <a href="https://www.voyageai.com" target="_blank" rel="noopener noreferrer" className="underline text-amber-400">voyageai.com</a>
              , then add <code className="font-mono">VOYAGE_API_KEY</code> to your Vercel environment variables and redeploy.
            </p>
          </div>
        </div>
      )}

      {/* URL input */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium mb-1">Add a URL to index</p>
          <p className="text-xs text-muted-foreground">
            Paste links to your website, docs, FAQ, or whitepaper — the AI reads and learns from them automatically.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="url"
              placeholder="https://docs.yourprotocol.com/faq"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && fetchUrl()}
              className="pl-9"
              disabled={isPending}
            />
          </div>
          <Button onClick={fetchUrl} disabled={isPending || !url.trim()}>
            {isPending && !showPaste
              ? <><Loader2 className="size-3.5 animate-spin mr-2" />Fetching…</>
              : <><Plus className="size-3.5 mr-1.5" />Fetch & Index</>
            }
          </Button>
        </div>
        {lastResult && (
          <span className="flex items-center gap-1 text-xs text-green-500">
            <CheckCircle2 className="size-3.5" />
            {lastResult}
          </span>
        )}
        <p className="text-xs text-muted-foreground">
          Add as many URLs as you like — each gets fetched, chunked, and stored for AI retrieval.
        </p>
      </div>

      {/* Paste fallback */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowPaste(v => !v)}
        >
          <FileText className="size-3.5" />
          {showPaste ? "Hide manual input" : "Or paste content manually"}
        </button>

        {showPaste && (
          <div className="mt-3 space-y-3 rounded-lg border border-border p-4">
            <textarea
              value={pasteContent}
              onChange={e => setPasteContent(e.target.value)}
              placeholder="Paste docs, FAQ, whitepaper, or any text you want the AI to know…"
              rows={8}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm leading-relaxed outline-none placeholder:text-muted-foreground focus:border-ring font-mono"
            />
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="Source URL (optional)"
                value={pasteUrl}
                onChange={e => setPasteUrl(e.target.value)}
                className="text-xs"
              />
              <Button size="sm" onClick={ingestPaste} disabled={isPending || !pasteContent.trim()}>
                {isPending && showPaste
                  ? <><Loader2 className="size-3.5 animate-spin mr-2" />Indexing…</>
                  : "Index content"
                }
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
