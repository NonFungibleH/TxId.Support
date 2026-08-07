import { createHash } from "crypto"
import type { createServiceClient } from "@/lib/supabase/server"
import { chunkText, embedBatch } from "@txid/ai"
import type { Json } from "@/lib/supabase/types"
import { isPrivateUrl } from "@/lib/security"

// Auth-free crawl+embed core, shared by the org-scoped crawlAndIngest action
// and the admin demo-docs action. NOT a server action - callers must do their
// own auth (ownership or admin) BEFORE calling this. Kept out of a "use server"
// file so it can't be invoked directly from the client.

export interface CrawlResult {
  ok: boolean
  pagesIndexed?: number
  chunksInserted?: number
  discovered?: number
  /** Pages fetched and found unchanged, so never re-embedded. */
  unchanged?: number
  /** Pages that had been indexed and have since disappeared. */
  pruned?: number
  error?: string
}

/** Per-page state from the previous crawl, keyed by url. */
interface SourceState {
  contentHash: string | null
  etag: string | null
  lastModified: string | null
}

function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex")
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

  // Everything we already know about these pages. Empty on a first crawl, in
  // which case every page is treated as changed, which is correct.
  const known = new Map<string, SourceState>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: priorSources } = await (supabase as any)
    .from("doc_sources")
    .select("url, content_hash, etag, last_modified")
    .eq("project_id", projectId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of (priorSources ?? []) as any[]) {
    known.set(s.url as string, {
      contentHash: s.content_hash ?? null,
      etag: s.etag ?? null,
      lastModified: s.last_modified ?? null,
    })
  }

  /** Validators the server gave us last time, so it can answer 304. */
  /**
   * IDENTIFY OURSELVES. We sent NO User-Agent at all, and a request with no UA
   * from a datacentre IP is what bot protection is built to stop: crawling a
   * Cloudflare-fronted documentation site returned 403 from Vercel while the
   * same request succeeded from a laptop. Nothing was wrong with the crawler,
   * it just looked like something worth blocking.
   *
   * An honest UA with a contact URL, rather than a browser impersonation: a
   * documentation host that would rather not be crawled should be able to say
   * so, and pretending to be Chrome takes that choice away.
   */
  const CRAWLER_HEADERS: Record<string, string> = {
    "User-Agent": "TxID-Docs-Indexer/1.0 (+https://txid.support; documentation indexing on behalf of the site owner)",
    Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
    "Accept-Language": "en",
  }

  const conditional = (url: string): Record<string, string> => {
    const prior = known.get(url)
    const h: Record<string, string> = { ...CRAWLER_HEADERS }
    if (!prior) return h
    if (prior.etag) h["If-None-Match"] = prior.etag
    if (prior.lastModified) h["If-Modified-Since"] = prior.lastModified
    return h
  }

  /** Validators to store for next time, when the origin supplies them. */
  const validators = new Map<string, { etag: string | null; lastModified: string | null }>()
  /** Pages the server told us had not changed, so the body was never sent. */
  const notModified = new Set<string>()

  const fetchPage = async (url: string, withLinks = false): Promise<string | null> => {
    try {
      if (url.endsWith(".md") || url.endsWith(".txt")) {
        // SSRF: `isPrivateUrl` checks the URL we were GIVEN, and fetch follows
        // redirects by default, so a public documentation host could 302 us
        // onto a private address or a cloud metadata endpoint. Handle
        // redirects manually and re-check every hop against the same guard.
        let target = url
        for (let hop = 0; hop < 4; hop++) {
          if (isPrivateUrl(target)) return null
          const r = await fetch(target, {
            signal: AbortSignal.timeout(15_000),
            headers: conditional(url),
            redirect: "manual",
          })
          if (r.status >= 300 && r.status < 400) {
            const loc = r.headers.get("location")
            if (!loc) return null
            try { target = new URL(loc, target).toString() } catch { return null }
            continue
          }
          if (r.status === 304) { notModified.add(url); return null }
          if (!r.ok) return null
          validators.set(url, {
            etag: r.headers.get("etag"),
            lastModified: r.headers.get("last-modified"),
          })
          return await r.text()
        }
        return null
        const res = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: conditional(url),
        })
        if (res.status === 304) { notModified.add(url); return null }
        if (!res.ok) return null
        validators.set(url, {
          etag: res.headers.get("etag"),
          lastModified: res.headers.get("last-modified"),
        })
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
    const llmsRes = await fetch(`${origin}/llms.txt`, { headers: CRAWLER_HEADERS, signal: AbortSignal.timeout(8_000) })
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
        const r = await fetch(candidate, { headers: CRAWLER_HEADERS, signal: AbortSignal.timeout(8_000) })
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
  // Every page answering 304 is a SUCCESSFUL crawl that found nothing to do,
  // which is the expected outcome most of the time once change detection is
  // working. Only an empty result with no 304s is a real failure.
  if (pageTexts.length === 0 && notModified.size > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("doc_sources").upsert(
      [...notModified].map(url => ({
        project_id: projectId,
        url,
        content_hash: known.get(url)?.contentHash ?? null,
        etag: known.get(url)?.etag ?? null,
        last_modified: known.get(url)?.lastModified ?? null,
        last_checked_at: new Date().toISOString(),
      })),
      { onConflict: "project_id,url" },
    )
    return { ok: true, pagesIndexed: 0, chunksInserted: 0, discovered: urls.length, unchanged: notModified.size }
  }
  if (pageTexts.length === 0) return { ok: false, error: "No content found on any discovered pages" }

  // Which pages actually moved. A page whose text hashes to the same value is
  // left completely alone: its chunks stay, and nothing is re-embedded.
  const now = new Date().toISOString()
  const changed: { url: string; text: string; hash: string }[] = []
  const unchangedUrls: string[] = []
  for (const { url, text } of pageTexts) {
    const hash = sha256(text)
    if (known.get(url)?.contentHash === hash) unchangedUrls.push(url)
    else changed.push({ url, text, hash })
  }

  // PRUNE. A page removed from the documentation was previously never fetched
  // again, so its chunks stayed in the knowledge base forever and the
  // assistant kept answering from documentation that no longer exists, with a
  // citation. That is worse than being stale, because it reads as authoritative.
  const seen = new Set<string>([...pageTexts.map(p => p.url), ...notModified])
  const vanished = [...known.keys()].filter(u => !seen.has(u))
  if (vanished.length > 0) {
    await supabase.from("documents").delete().eq("project_id", projectId).in("source_url", vanished)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("doc_sources").delete().eq("project_id", projectId).in("url", vanished)
  }

  // Only the changed pages lose their chunks, so an unchanged page is never
  // briefly absent from the knowledge base mid-crawl.
  if (changed.length > 0) {
    await supabase.from("documents").delete().eq("project_id", projectId).in("source_url", changed.map(c => c.url))
  }

  type ChunkRow = { url: string; content: string; chunkIndex: number; totalChunks: number }
  const allChunks: ChunkRow[] = []
  for (const { url, text } of changed) {
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

  if (rows.length > 0) {
    const { error: insertError } = await supabase.from("documents").insert(rows)
    if (insertError) return { ok: false, error: insertError.message }
  }

  // Record what we now know about every page still present, including the ones
  // that did not change: "we looked and it was the same" is the fact that makes
  // a freshness claim honest.
  const stateRows = [
    ...changed.map(c => ({
      project_id: projectId,
      url: c.url,
      content_hash: c.hash,
      etag: validators.get(c.url)?.etag ?? null,
      last_modified: validators.get(c.url)?.lastModified ?? null,
      last_checked_at: now,
      last_changed_at: now,
    })),
    ...[...unchangedUrls, ...notModified].map(url => ({
      project_id: projectId,
      url,
      content_hash: known.get(url)?.contentHash ?? null,
      etag: validators.get(url)?.etag ?? known.get(url)?.etag ?? null,
      last_modified: validators.get(url)?.lastModified ?? known.get(url)?.lastModified ?? null,
      last_checked_at: now,
      // Deliberately not touched: the page has not changed, so the date it
      // last did is still true.
      ...(known.get(url) ? {} : { last_changed_at: now }),
    })),
  ]
  if (stateRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("doc_sources").upsert(stateRows, { onConflict: "project_id,url" })
  }

  return {
    ok: true,
    pagesIndexed: changed.length,
    chunksInserted: rows.length,
    discovered: urls.length,
    unchanged: unchangedUrls.length + notModified.size,
    ...(vanished.length > 0 ? { pruned: vanished.length } : {}),
  }
}
