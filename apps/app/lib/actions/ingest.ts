"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { chunkText, embedBatch } from "@txid/ai"
import { revalidatePath } from "next/cache"
import type { Json } from "@/lib/supabase/types"

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
): Promise<{ ok: boolean; pagesIndexed?: number; chunksInserted?: number; error?: string }> {
  const { userId } = await auth()
  if (!userId) return { ok: false, error: "Unauthorized" }

  let parsed: URL
  try {
    parsed = new URL(rootUrl)
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error()
  } catch {
    return { ok: false, error: "Invalid URL" }
  }

  const origin = parsed.origin
  const MAX_PAGES = 60

  const fetchPage = async (url: string, withLinks = false): Promise<string | null> => {
    try {
      const headers: Record<string, string> = { "Accept": "text/plain", "X-No-Cache": "true" }
      if (withLinks) headers["X-With-Links-Summary"] = "true"
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers,
        signal: AbortSignal.timeout(20_000),
      })
      if (!res.ok) return null
      return await res.text()
    } catch {
      return null
    }
  }

  const discovered = new Set<string>()

  const normUrl = (raw: string): string | null => {
    try {
      const u = new URL(raw.trim())
      if (u.origin !== origin) return null
      if (/\.(pdf|zip|png|jpg|jpeg|gif|svg|ico|css|js)$/i.test(u.pathname)) return null
      u.hash = ""
      return u.toString().replace(/\/$/, "")
    } catch { return null }
  }

  const extractLinksFromText = (text: string) => {
    // Absolute markdown links: [text](https://...)
    for (const match of text.matchAll(/\(((https?:\/\/[^)\s"]+))\)/g)) {
      const n = normUrl(match[1]); if (n) discovered.add(n)
    }
    // Absolute href attributes
    for (const match of text.matchAll(/href=["'](https?:\/\/[^"'\s>]+)["']/g)) {
      const n = normUrl(match[1]); if (n) discovered.add(n)
    }
    // Relative href attributes — resolve against origin (e.g. Gitbook nav links)
    for (const match of text.matchAll(/href=["'](\/[^"'\s>]+)["']/g)) {
      const n = normUrl(`${origin}${match[1]}`); if (n) discovered.add(n)
    }
    // Relative markdown links: [text](/path)
    for (const match of text.matchAll(/\((\/[^)\s"#][^)]*)\)/g)) {
      const n = normUrl(`${origin}${match[1]}`); if (n) discovered.add(n)
    }
  }

  // ── Step 1: try sitemap via robots.txt and common paths ──────────────────
  let foundSitemap = false
  const sitemapCandidates: string[] = []

  // Check robots.txt for Sitemap: directive
  try {
    const robotsRes = await fetch(`${origin}/robots.txt`, { signal: AbortSignal.timeout(8_000) })
    if (robotsRes.ok) {
      const robots = await robotsRes.text()
      for (const match of robots.matchAll(/^Sitemap:\s*(.+)$/gmi)) {
        sitemapCandidates.push(match[1].trim())
      }
    }
  } catch { /* ignore */ }

  // Add common fallback paths
  sitemapCandidates.push(
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap-0.xml`,
    `${origin}/sitemap/sitemap.xml`,
  )

  const parseSitemapXml = async (xml: string) => {
    const locs = [...xml.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/g)]
    if (xml.includes("<sitemapindex")) {
      // Sitemap index — fetch each child
      for (const loc of locs.slice(0, 10)) {
        try {
          const r = await fetch(loc[1].trim(), { signal: AbortSignal.timeout(8_000) })
          if (r.ok) { const child = await r.text(); for (const cl of child.matchAll(/<loc>\s*(https?:\/\/[^<\s]+)\s*<\/loc>/g)) { const n = normUrl(cl[1]); if (n) discovered.add(n) } }
        } catch { /* skip */ }
      }
    } else {
      for (const loc of locs) { const n = normUrl(loc[1]); if (n) discovered.add(n) }
    }
  }

  for (const candidate of sitemapCandidates) {
    if (foundSitemap) break
    try {
      const r = await fetch(candidate, { signal: AbortSignal.timeout(8_000) })
      if (r.ok) {
        const text = await r.text()
        if (text.includes("<loc>")) {
          await parseSitemapXml(text)
          if (discovered.size > 0) foundSitemap = true
        }
      }
    } catch { /* try next */ }
  }

  // ── Step 2: BFS link extraction (2 levels deep) as fallback ──────────────
  if (!foundSitemap) {
    // Level 1: root page
    const rootText = await fetchPage(rootUrl, true)
    if (!rootText || rootText.trim().length < 50) {
      return { ok: false, error: "Could not fetch root page" }
    }
    discovered.add(rootUrl.replace(/\/$/, ""))
    extractLinksFromText(rootText)

    // Level 2: follow each discovered link and extract its links too
    const level1 = [...discovered].slice(0, 20)
    const level1Texts = await Promise.all(level1.map(u => fetchPage(u, true)))
    level1Texts.forEach(t => { if (t) extractLinksFromText(t) })
  }

  discovered.add(rootUrl.replace(/\/$/, ""))
  const urls = [...discovered].slice(0, MAX_PAGES)

  // Crawl all pages in parallel batches of 5
  const CONCURRENCY = 5
  let totalChunks = 0
  let pagesIndexed = 0

  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY)
    const texts = await Promise.all(batch.map((url) => fetchPage(url)))

    await Promise.all(batch.map(async (url, idx) => {
      const text = texts[idx]
      if (!text || text.trim().length < 100) return
      const result = await ingestText(projectId, text.trim(), url)
      if (result.ok && result.chunksInserted) {
        totalChunks += result.chunksInserted
        pagesIndexed++
      }
    }))
  }

  revalidatePath("/dashboard")
  return { ok: true, pagesIndexed, chunksInserted: totalChunks }
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
