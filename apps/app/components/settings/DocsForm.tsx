"use client"

import { useState, useTransition, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Loader2, CheckCircle2, Trash2, Plus, Globe, FileText,
  AlertTriangle, RefreshCw, X, Layers,
} from "lucide-react"
import { fetchAndIngest, ingestText, clearKnowledgeBase, deleteSource, crawlAndIngest } from "@/lib/actions/ingest"

interface Source {
  url: string
  count: number
}

interface DocsFormProps {
  projectId: string
  initialDocsUrl: string | null
  docCount: number
  pastedChunkCount: number
  sources: Source[]
  voyageKeySet: boolean
}

export function DocsForm({ projectId, docCount, pastedChunkCount, sources: initialSources, voyageKeySet }: DocsFormProps) {
  const [url, setUrl] = useState("")
  const [totalChunks, setTotalChunks] = useState(docCount)
  const [sources, setSources] = useState<Source[]>(initialSources)
  const [pastedCount, setPastedCount] = useState(pastedChunkCount)
  const [isPending, startTransition] = useTransition()
  const [refreshingUrl, setRefreshingUrl] = useState<string | null>(null)
  const [deletingUrl, setDeletingUrl] = useState<string | null>(null)
  const [crawling, setCrawling] = useState(false)
  const [crawlStatus, setCrawlStatus] = useState<string | null>(null)
  const [crawlElapsed, setCrawlElapsed] = useState(0)
  const crawlTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (crawling) {
      setCrawlElapsed(0)
      crawlTimerRef.current = setInterval(() => setCrawlElapsed(s => s + 1), 1000)
    } else {
      if (crawlTimerRef.current) clearInterval(crawlTimerRef.current)
    }
    return () => { if (crawlTimerRef.current) clearInterval(crawlTimerRef.current) }
  }, [crawling])

  const CRAWL_MESSAGES = [
    { until: 5,  text: "Discovering pages on the site…" },
    { until: 15, text: "Fetching page content…" },
    { until: 30, text: "Indexing pages — this takes a moment…" },
    { until: 50, text: "Still working — larger sites take up to 60 seconds…" },
    { until: Infinity, text: "Almost done, hang tight…" },
  ]
  const crawlMessage = CRAWL_MESSAGES.find(m => crawlElapsed < m.until)?.text ?? "Working…"

  // Manual paste fallback
  const [showPaste, setShowPaste] = useState(false)
  const [pasteContent, setPasteContent] = useState("")
  const [pasteUrl, setPasteUrl] = useState("")

  function crawlSite() {
    if (!url.trim()) { toast.error("Enter a URL first"); return }
    const targetUrl = url.trim()
    setCrawling(true)
    setCrawlStatus(null)
    toast.info("Crawl started — this typically takes 30–60 seconds. Keep this tab open.", { duration: 8000 })
    startTransition(async () => {
      const result = await crawlAndIngest(projectId, targetUrl)
      setCrawling(false)
      if (result.ok) {
        const msg = `Crawled ${result.pagesIndexed} pages, indexed ${result.chunksInserted} chunks`
        setCrawlStatus(msg)
        toast.success(msg)
        // Refresh page to show updated source list
        window.location.reload()
      } else {
        setCrawlStatus(null)
        toast.error(result.error ?? "Crawl failed")
      }
    })
  }

  function fetchUrl() {
    if (!url.trim()) { toast.error("Enter a URL first"); return }
    const targetUrl = url.trim()
    startTransition(async () => {
      const result = await fetchAndIngest(projectId, targetUrl)
      if (result.ok && result.chunksInserted) {
        toast.success(`Indexed ${result.chunksInserted} chunks from ${targetUrl}`)
        setSources(prev => {
          const exists = prev.find(s => s.url === targetUrl)
          if (exists) return prev.map(s => s.url === targetUrl ? { ...s, count: result.chunksInserted! } : s)
          return [...prev, { url: targetUrl, count: result.chunksInserted! }]
        })
        setTotalChunks(n => n + result.chunksInserted!)
        setUrl("")
      } else {
        toast.error(result.error ?? "Failed to index URL")
      }
    })
  }

  function refresh(sourceUrl: string) {
    setRefreshingUrl(sourceUrl)
    startTransition(async () => {
      const result = await fetchAndIngest(projectId, sourceUrl)
      if (result.ok && result.chunksInserted != null) {
        toast.success(`Re-indexed ${result.chunksInserted} chunks`)
        setSources(prev =>
          prev.map(s => s.url === sourceUrl ? { ...s, count: result.chunksInserted! } : s),
        )
        // total changed: removed old count, added new count
        setTotalChunks(prev => {
          const old = sources.find(s => s.url === sourceUrl)?.count ?? 0
          return prev - old + result.chunksInserted!
        })
      } else {
        toast.error(result.error ?? "Refresh failed")
      }
      setRefreshingUrl(null)
    })
  }

  function removeSource(sourceUrl: string) {
    setDeletingUrl(sourceUrl)
    startTransition(async () => {
      const result = await deleteSource(projectId, sourceUrl)
      if (result.ok) {
        const removed = sources.find(s => s.url === sourceUrl)?.count ?? 0
        setSources(prev => prev.filter(s => s.url !== sourceUrl))
        setTotalChunks(n => n - removed)
        toast.success("Source removed")
      } else {
        toast.error(result.error ?? "Failed to remove source")
      }
      setDeletingUrl(null)
    })
  }

  function ingestPaste() {
    if (!pasteContent.trim()) { toast.error("Paste some content first"); return }
    startTransition(async () => {
      const result = await ingestText(projectId, pasteContent, pasteUrl.trim() || undefined)
      if (result.ok && result.chunksInserted) {
        toast.success(`Indexed ${result.chunksInserted} chunks`)
        if (pasteUrl.trim()) {
          setSources(prev => {
            const exists = prev.find(s => s.url === pasteUrl.trim())
            if (exists) return prev.map(s => s.url === pasteUrl.trim() ? { ...s, count: result.chunksInserted! } : s)
            return [...prev, { url: pasteUrl.trim(), count: result.chunksInserted! }]
          })
        } else {
          setPastedCount(n => n + result.chunksInserted!)
        }
        setTotalChunks(n => n + result.chunksInserted!)
        setPasteContent("")
        setPasteUrl("")
        setShowPaste(false)
      } else {
        toast.error(result.error ?? "Ingestion failed")
      }
    })
  }

  function clearAll() {
    startTransition(async () => {
      const result = await clearKnowledgeBase(projectId)
      if (result.ok) {
        toast.success("Knowledge base cleared")
        setSources([])
        setTotalChunks(0)
        setPastedCount(0)
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
        <Badge variant={totalChunks > 0 ? "default" : "secondary"}>
          {totalChunks} chunk{totalChunks !== 1 ? "s" : ""} indexed
        </Badge>
        {totalChunks > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            onClick={clearAll}
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

      {/* Indexed sources list */}
      {(sources.length > 0 || pastedCount > 0) && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Indexed sources</p>
          <div className="rounded-lg border border-border divide-y divide-border">
            {sources.map((source) => (
              <div key={source.url} className="flex items-center gap-3 px-3 py-2.5">
                <Globe className="size-3.5 text-muted-foreground shrink-0" />
                <span
                  className="flex-1 text-xs font-mono text-foreground truncate"
                  title={source.url}
                >
                  {source.url}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                  {source.count} chunk{source.count !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => refresh(source.url)}
                  disabled={isPending}
                  title="Re-fetch and re-index"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                >
                  {refreshingUrl === source.url
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <RefreshCw className="size-3.5" />
                  }
                </button>
                <button
                  onClick={() => removeSource(source.url)}
                  disabled={isPending}
                  title="Remove this source"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
                >
                  {deletingUrl === source.url
                    ? <Loader2 className="size-3.5 animate-spin" />
                    : <X className="size-3.5" />
                  }
                </button>
              </div>
            ))}
            {pastedCount > 0 && (
              <div className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="size-3.5 text-muted-foreground shrink-0" />
                <span className="flex-1 text-xs text-muted-foreground italic">Pasted content</span>
                <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                  {pastedCount} chunk{pastedCount !== 1 ? "s" : ""}
                </span>
                <div className="size-6" />
                <div className="size-6" />
              </div>
            )}
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
          <Button onClick={fetchUrl} disabled={isPending || crawling || !url.trim()}>
            {isPending && !showPaste && !crawling
              ? <><Loader2 className="size-3.5 animate-spin mr-2" />Fetching…</>
              : <><Plus className="size-3.5 mr-1.5" />Fetch page</>
            }
          </Button>
          <Button variant="outline" onClick={crawlSite} disabled={isPending || crawling || !url.trim()} title="Crawl all pages on this domain (up to 60)">
            {crawling
              ? <><Loader2 className="size-3.5 animate-spin mr-2" />Crawling…</>
              : <><Layers className="size-3.5 mr-1.5" />Crawl site</>
            }
          </Button>
        </div>
        {crawlStatus
          ? <p className="text-xs text-green-500 flex items-center gap-1.5"><CheckCircle2 className="size-3.5" />{crawlStatus}</p>
          : crawling
          ? <div className="space-y-1">
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin" />{crawlMessage}
              </p>
              <p className="text-xs text-muted-foreground">{crawlElapsed}s elapsed — please keep this tab open</p>
            </div>
          : <p className="text-xs text-muted-foreground">Use <strong>Fetch page</strong> for a single URL, or <strong>Crawl site</strong> to automatically index all pages on the domain (up to 60).</p>
        }
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

      {totalChunks > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-green-500">
          <CheckCircle2 className="size-3.5" />
          Knowledge base active — the AI will draw on these sources when answering user questions.
        </p>
      )}
    </div>
  )
}
