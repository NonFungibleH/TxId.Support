import type { createServiceClient } from "@/lib/supabase/server"
import { chunkText, embedBatch } from "@txid/ai"
import type { Json } from "@/lib/supabase/types"
import { isPrivateUrl } from "@/lib/security"

// Auth-free crawl+embed core, shared by the org-scoped crawlAndIngest action
// and the admin demo-docs action. NOT a server action — callers must do their
// own auth (ownership or admin) BEFORE calling this. Kept out of a "use server"
// file so it can't be invoked directly from the client.

export interface CrawlResult {
  ok: boolean
  pagesIndexed?: number
  chunksInserted?: number
  discovered?: number
  error?: string
}

export async function crawlAndIngestCore(
  supabase: ReturnType<typeof createServiceClient>,
  projectId: string,
  rootUrl: string,
): Promise<CrawlResult> {
  let parsed: URL
  try {
    parsed = new URL(rootUrl)
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error()
  } catch {
    return { ok: false, error: "Invalid URL" }
  }
  if (isPrivateUrl(rootUrl)) return { ok: false, error: "Invalid URL" }

  const origin = parsed.origin
  const MAX_PAGES = 60

  const fetchPage = async (url: string, withLinks = false): Promise<string | null> => {
    try {
      if (url.endsWith(".md") || url.endsWith(".txt")) {
        const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
        if (!res.ok) return null
        return await res.text()
      }
      const headers: Record<string, string> = { "Accept": "text/plain", "X-No-Cache": "true" }
      if (withLinks) headers["X-With-Links-Summary"] = "true"
      const res = await fetch(`https://r.jina.ai/${url}`, { headers, signal: AbortSignal.timeout(20_000) })
      if (!res.ok) return null
      return await res.text()
    } catch { return null }
  }

  const discovered = new Set<string>()

  // Step 1: llms.txt (Gitbook / modern doc sites list all pages here)
  let usedLlmsTxt = false
  try {
    const llmsRes = await fetch(`${origin}/llms.txt`, { signal: AbortSignal.timeout(8_000) })
    if (llmsRes.ok) {
      const llmsText = await llmsRes.text()
      for (const match of llmsText.matchAll(/\((https?:\/\/[^)]+\.md)\)/g)) {
        const url = match[1].trim()
        try { const u = new URL(url); if (u.origin === origin && !url.includes("?")) discovered.add(url) } catch { /* skip */ }
      }
      if (discovered.size > 0) usedLlmsTxt = true
    }
  } catch { /* ignore */ }

  // Step 2: sitemap fallback
  if (!usedLlmsTxt) {
    const sitemapCandidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-0.xml`]
    for (const candidate of sitemapCandidates) {
      if (discovered.size > 0) break
      try {
        const r = await fetch(candidate, { signal: AbortSignal.timeout(8_000) })
        if (r.ok) {
          const xml = await r.text()
          if (xml.includes("<loc>")) {
            for (const loc of xml.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/g)) {
              try { const u = new URL(loc[1].trim()); if (u.origin === origin) discovered.add(loc[1].trim()) } catch { /* skip */ }
            }
          }
        }
      } catch { /* try next */ }
    }
  }

  // Step 3: Jina root page fallback (full nav link list)
  if (discovered.size < 3) {
    const rootText = await fetchPage(rootUrl, true)
    if (!rootText || rootText.trim().length < 50) return { ok: false, error: "Could not fetch root page" }
    discovered.add(rootUrl.replace(/\/$/, ""))
    for (const match of rootText.matchAll(/\(((https?:\/\/[^)\s"]+))\)/g)) {
      try { const u = new URL(match[1].trim()); if (u.origin === origin) { u.hash = ""; u.search = ""; discovered.add(u.toString().replace(/\/$/, "")) } } catch { /* skip */ }
    }
  }

  discovered.add(rootUrl.replace(/\/$/, ""))
  const urls = [...discovered].slice(0, MAX_PAGES)

  const pageTexts: { url: string; text: string }[] = []
  for (const url of urls) {
    const text = await fetchPage(url)
    if (text && text.trim().length > 50) pageTexts.push({ url, text: text.trim() })
  }
  if (pageTexts.length === 0) return { ok: false, error: "No content found on any discovered pages" }

  await supabase.from("documents").delete().eq("project_id", projectId).in("source_url", pageTexts.map(p => p.url))

  type ChunkRow = { url: string; content: string; chunkIndex: number; totalChunks: number }
  const allChunks: ChunkRow[] = []
  for (const { url, text } of pageTexts) {
    const chunks = chunkText(text)
    chunks.forEach((c, i) => allChunks.push({ url, content: c, chunkIndex: i, totalChunks: chunks.length }))
  }

  const EMBED_BATCH = 64
  const rows: Array<{ project_id: string; content: string; embedding: number[]; source_url: string; metadata: Json }> = []
  for (let i = 0; i < allChunks.length; i += EMBED_BATCH) {
    const batch = allChunks.slice(i, i + EMBED_BATCH)
    try {
      const embeddings = await embedBatch(batch.map(c => c.content))
      batch.forEach((c, j) => rows.push({
        project_id: projectId,
        content: c.content,
        embedding: embeddings[j],
        source_url: c.url,
        metadata: { chunkIndex: c.chunkIndex, totalChunks: c.totalChunks } as Json,
      }))
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Embedding failed" }
    }
  }

  const { error: insertError } = await supabase.from("documents").insert(rows)
  if (insertError) return { ok: false, error: insertError.message }

  return { ok: true, pagesIndexed: pageTexts.length, chunksInserted: rows.length, discovered: urls.length }
}
