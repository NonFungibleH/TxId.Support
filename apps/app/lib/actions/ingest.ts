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

  // Fetch page content
  let html: string
  try {
    const res = await fetch(parsed.toString(), {
      headers: { "User-Agent": "TxIDSupportBot/1.0 (+https://txid.support)" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, error: `Failed to fetch URL (status ${res.status})` }
    html = await res.text()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not fetch URL" }
  }

  // Strip HTML to plain text
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim()

  if (text.length < 100) {
    return { ok: false, error: "Page content too short or could not be extracted. Try pasting the content manually." }
  }

  return ingestText(projectId, text, url)
}
