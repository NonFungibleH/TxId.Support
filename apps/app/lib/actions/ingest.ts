"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { chunkText, embedBatch } from "@txid/ai"
import { revalidatePath } from "next/cache"
import type { Json } from "@/lib/supabase/types"
import { isPrivateUrl } from "@/lib/security"

/**
 * Ingest plain text into the project's knowledge base.
 * Chunks the text, embeds each chunk with Voyage AI, and stores in Supabase.
 */
export async function ingestText(
  projectId: string,
  text: string,
  sourceUrl?: string,
): Promise<{ ok: boolean; chunksInserted?: number; error?: string }> {
  const { orgId, userId } = await auth()
  if (!userId) return { ok: false, error: "Unauthorized" }
  const orgKey = orgId ?? userId

  const trimmed = text.trim()
  if (trimmed.length < 50) return { ok: false, error: "Content too short" }
  if (trimmed.length > 500_000) return { ok: false, error: "Content too large (max 500k chars)" }

  const supabase = createServiceClient()

  // Verify project belongs to this org
  const { data: project, error: projError } = await supabase
    .from("projects")
    .select("id, org_id")
    .eq("id", projectId)
    .single()

  if (projError || !project) return { ok: false, error: "Project not found" }

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("id", project.org_id)
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org) return { ok: false, error: "Forbidden" }

  // If re-ingesting from same source URL, remove old chunks first
  if (sourceUrl) {
    await supabase
      .from("documents")
      .delete()
      .eq("project_id", projectId)
      .eq("source_url", sourceUrl)
  }

  // Chunk the text
  const chunks = chunkText(trimmed)
  if (chunks.length === 0) return { ok: false, error: "No content extracted" }

  try {
    // Embed all chunks in one batch call (Voyage AI supports up to 128 inputs)
    const BATCH_SIZE = 64
    const rows: Array<{
      project_id: string
      content: string
      embedding: number[]
      source_url: string | null
      metadata: Json
    }> = []

    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE)
      const embeddings = await embedBatch(batch)
      for (let j = 0; j < batch.length; j++) {
        rows.push({
          project_id: projectId,
          content: batch[j],
          embedding: embeddings[j],
          source_url: sourceUrl ?? null,
          metadata: { chunkIndex: i + j, totalChunks: chunks.length },
        })
      }
    }

    const { error: insertError } = await supabase.from("documents").insert(rows)
    if (insertError) return { ok: false, error: insertError.message }

    revalidatePath("/dashboard")
    return { ok: true, chunksInserted: rows.length }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Embedding failed"
    return { ok: false, error: msg }
  }
}

/**
 * Delete all indexed documents for a single source URL.
 */
export async function deleteSource(
  projectId: string,
  sourceUrl: string,
): Promise<{ ok: boolean; error?: string }> {
  const { orgId, userId } = await auth()
  if (!userId) return { ok: false, error: "Unauthorized" }
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const { data: project } = await supabase
    .from("projects")
    .select("id, org_id")
    .eq("id", projectId)
    .single()

  if (!project) return { ok: false, error: "Project not found" }

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("id", project.org_id)
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org) return { ok: false, error: "Forbidden" }

  await supabase.from("documents").delete().eq("project_id", projectId).eq("source_url", sourceUrl)
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * Delete all indexed documents for a project (full reset).
 */
export async function clearKnowledgeBase(
  projectId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { orgId, userId } = await auth()
  if (!userId) return { ok: false, error: "Unauthorized" }
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const { data: project } = await supabase
    .from("projects")
    .select("id, org_id")
    .eq("id", projectId)
    .single()

  if (!project) return { ok: false, error: "Project not found" }

  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("id", project.org_id)
    .eq("clerk_org_id", orgKey)
    .single()

  if (!org) return { ok: false, error: "Forbidden" }

  await supabase.from("documents").delete().eq("project_id", projectId)
  revalidatePath("/dashboard")
  return { ok: true }
}

/**
 * Crawl all pages on a domain and ingest them.
 * Fetches the root URL, discovers same-domain links, then crawls each page.
 * Capped at 60 pages to avoid runaway crawls.
 */
export async function crawlAndIngest(
  projectId: string,
  rootUrl: string,
): Promise<{ ok: boolean; pagesIndexed?: number; chunksInserted?: number; discovered?: number; error?: string }> {
  const { orgId, userId } = await auth()
  if (!userId) return { ok: false, error: "Unauthorized" }

  let parsed: URL
  try {
    parsed = new URL(rootUrl)
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error()
  } catch {
    return { ok: false, error: "Invalid URL" }
  }

  if (isPrivateUrl(rootUrl)) return { ok: false, error: "Invalid URL" }

  // Ownership check before any network fetches to prevent auth-bypass SSRF
  const orgKey = orgId ?? userId
  const supabase = createServiceClient()

  const { data: project } = await supabase.from("projects").select("id, org_id").eq("id", projectId).single()
  if (!project) return { ok: false, error: "Project not found" }

  const { data: org } = await supabase.from("organisations").select("id").eq("id", project.org_id).eq("clerk_org_id", orgKey).single()
  if (!org) return { ok: false, error: "Forbidden" }

  const origin = parsed.origin
  const MAX_PAGES = 60

  // Fetch a page: .md files fetched directly, everything else via Jina renderer
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

  // ── Step 1: check for llms.txt (Gitbook and modern doc sites list all pages here) ──
  let usedLlmsTxt = false
  try {
    const llmsRes = await fetch(`${origin}/llms.txt`, { signal: AbortSignal.timeout(8_000) })
    if (llmsRes.ok) {
      const llmsText = await llmsRes.text()
      // Extract .md page URLs — these are fetchable markdown versions of each page
      for (const match of llmsText.matchAll(/\((https?:\/\/[^)]+\.md)\)/g)) {
        const url = match[1].trim()
        try {
          const u = new URL(url)
          if (u.origin === origin && !url.includes("?")) discovered.add(url)
        } catch { /* skip */ }
      }
      if (discovered.size > 0) usedLlmsTxt = true
    }
  } catch { /* ignore */ }

  // ── Step 2: sitemap fallback (for non-Gitbook sites) ──────────────────────
  if (!usedLlmsTxt) {
    const sitemapCandidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`, `${origin}/sitemap-0.xml`]
    for (const candidate of sitemapCandidates) {
      if (discovered.size > 0) break
      try {
        const r = await fetch(candidate, { signal: AbortSignal.timeout(8_000) })
        if (r.ok) {
          const xml = await r.text()
          if (xml.includes("<loc>")) {
            const locs = [...xml.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/g)]
            for (const loc of locs) {
              try { const u = new URL(loc[1].trim()); if (u.origin === origin) discovered.add(loc[1].trim()) } catch { /* skip */ }
            }
          }
        }
      } catch { /* try next */ }
    }
  }

  // ── Step 3: Jina root page as final fallback (returns full nav link list) ──
  if (discovered.size < 3) {
    const rootText = await fetchPage(rootUrl, true)
    if (!rootText || rootText.trim().length < 50) {
      return { ok: false, error: "Could not fetch root page" }
    }
    discovered.add(rootUrl.replace(/\/$/, ""))
    // Extract all absolute markdown links from Jina's Links/Buttons section
    for (const match of rootText.matchAll(/\(((https?:\/\/[^)\s"]+))\)/g)) {
      try { const u = new URL(match[1].trim()); if (u.origin === origin) { u.hash=""; u.search=""; discovered.add(u.toString().replace(/\/$/, "")) } } catch { /* skip */ }
    }
  }

  discovered.add(rootUrl.replace(/\/$/, ""))
  const urls = [...discovered].slice(0, MAX_PAGES)
  console.log(`[crawl] discovered ${urls.length} URLs for ${rootUrl}`)

  // ── Fetch all pages sequentially ──────────────────────────────────────────
  const pageTexts: { url: string; text: string }[] = []
  for (const url of urls) {
    const text = await fetchPage(url)
    if (text && text.trim().length > 50) {
      pageTexts.push({ url, text: text.trim() })
    }
  }
  if (pageTexts.length === 0) return { ok: false, error: "No content found on any discovered pages" }

  // Remove any existing docs from these sources
  await supabase.from("documents").delete().eq("project_id", projectId).in("source_url", pageTexts.map(p => p.url))

  // ── Chunk all pages together ───────────────────────────────────────────────
  type ChunkRow = { url: string; content: string; chunkIndex: number; totalChunks: number }
  const allChunks: ChunkRow[] = []
  for (const { url, text } of pageTexts) {
    const chunks = chunkText(text)
    chunks.forEach((c, i) => allChunks.push({ url, content: c, chunkIndex: i, totalChunks: chunks.length }))
  }

  // ── Embed all chunks in batches of 64 (minimises Voyage API calls) ────────
  // With 28 pages ≈ 84 chunks → 2 Voyage calls total (vs 28 previously).
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
      console.error(`[crawl] embed batch ${i}–${i + batch.length} failed:`, err)
      return { ok: false, error: err instanceof Error ? err.message : "Embedding failed" }
    }
  }

  // ── Bulk insert ────────────────────────────────────────────────────────────
  const { error: insertError } = await supabase.from("documents").insert(rows)
  if (insertError) return { ok: false, error: insertError.message }

  revalidatePath("/dashboard")
  return {
    ok: true,
    pagesIndexed: pageTexts.length,
    chunksInserted: rows.length,
    discovered: urls.length,
  }
}

/**
 * Fetch a URL and ingest its text content into the knowledge base.
 */
export async function fetchAndIngest(
  projectId: string,
  url: string,
): Promise<{ ok: boolean; chunksInserted?: number; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: "Unauthorized" }

  // Validate URL
  let parsed: URL
  try {
    parsed = new URL(url)
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error()
  } catch {
    return { ok: false, error: "Invalid URL — must start with http:// or https://" }
  }

  if (isPrivateUrl(url)) return { ok: false, error: "Invalid URL — must start with http:// or https://" }

  // Use Jina Reader to fetch + render the page (handles JS-heavy sites)
  // r.jina.ai renders the full page and returns clean markdown text — no API key needed
  let text: string
  try {
    const jinaUrl = `https://r.jina.ai/${parsed.toString()}`
    const res = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "X-No-Cache": "true",
      },
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) return { ok: false, error: `Could not fetch page (status ${res.status}). Check the URL is public and try again.` }
    text = await res.text()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not fetch URL — check it is publicly accessible" }
  }

  if (text.trim().length < 100) {
    return { ok: false, error: "Page appears to be empty or blocked. Try a more specific URL (e.g. a docs page) or paste the content manually." }
  }

  return ingestText(projectId, text.trim(), url)
}
