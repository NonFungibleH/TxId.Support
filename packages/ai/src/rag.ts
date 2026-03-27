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
  const { limit = 5, threshold = 0.65 } = opts

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

  const context = rows.map((r) => r.content).join("\n\n---\n\n")

  return {
    context,
    chunks: rows.map((r) => ({
      content: r.content,
      source: r.source_url,
      score: r.similarity,
    })),
  }
}
