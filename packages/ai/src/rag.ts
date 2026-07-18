import type { SupabaseClient } from "@supabase/supabase-js"
import { embedText } from "./embed"
import type { RagResult } from "./types"

interface MatchRow {
  id: string
  content: string
  source_url: string | null
  similarity: number
}

/**
 * Retrieve relevant document chunks from pgvector for a given query.
 * Returns formatted context string + raw chunk metadata.
 */
export async function retrieveContext(
  supabase: SupabaseClient,
  projectId: string,
  query: string,
  opts: { limit?: number; threshold?: number } = {},
): Promise<RagResult> {
  const { limit = 8, threshold = 0.35 } = opts

  // Embed the user query
  const embedding = await embedText(query)

  // Similarity search via Supabase RPC
  const { data, error } = await supabase.rpc("match_documents", {
    query_embedding: embedding,
    project_id: projectId,
    match_count: limit,
    match_threshold: threshold,
  })

  if (error) {
    // Non-fatal: if no docs indexed yet, return empty context
    console.error("[rag] match_documents error:", error.message)
    return { context: "", chunks: [] }
  }

  const rows = (data ?? []) as MatchRow[]

  if (rows.length === 0) {
    return { context: "", chunks: [] }
  }

  // Hard char budget for the assembled context (~6k tokens). Pathological
  // ingestion — e.g. crawling a JS-heavy SPA — can store enormous chunks, and
  // joining a handful of them blew the model's 200k context window (observed:
  // 298k-token prompts → hard 400 on every message). Accumulate up to the
  // budget, truncating the chunk that crosses it, so RAG can never overflow.
  const MAX_CONTEXT_CHARS = 24_000
  const SEP = "\n\n---\n\n"
  const parts: string[] = []
  let used = 0
  for (const r of rows) {
    if (used >= MAX_CONTEXT_CHARS) break
    const remaining = MAX_CONTEXT_CHARS - used
    const piece = r.content.length > remaining ? r.content.slice(0, remaining) : r.content
    parts.push(piece)
    used += piece.length + SEP.length
  }
  const context = parts.join(SEP)

  return {
    context,
    chunks: rows.map((r) => ({
      content: r.content,
      source: r.source_url,
      score: r.similarity,
    })),
  }
}
