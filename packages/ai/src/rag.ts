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
    return { context: "", chunks: [], includedChunks: 0, contextChars: 0 }
  }

  let rows = (data ?? []) as MatchRow[]

  // SECOND PASS AT A LOWER BAR when the first finds nothing.
  //
  // 0.35 is right for a specific question and wrong for a short vague one:
  // "what is the cost?" carries no domain terms, scores under the bar against
  // a Fees page that answers it perfectly, and the assistant then says it has
  // no pricing information while the answer sits three chunks away. Real
  // users ask short questions.
  //
  // Only ever runs on a MISS, so precision on normal queries is untouched and
  // the extra vector search costs nothing on the common path. A weak match is
  // still labelled weak downstream: `retrieval.topScore` records what was
  // actually found, so a thin answer stays visibly thin in the record.
  const RETRY_THRESHOLD = 0.22
  if (rows.length === 0 && threshold > RETRY_THRESHOLD) {
    const retry = await supabase.rpc("match_documents", {
      query_embedding: embedding,
      project_id: projectId,
      match_count: limit,
      match_threshold: RETRY_THRESHOLD,
    })
    if (!retry.error) rows = (retry.data ?? []) as MatchRow[]
  }

  if (rows.length === 0) {
    return { context: "", chunks: [], includedChunks: 0, contextChars: 0 }
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
  let includedChunks = 0
  for (const r of rows) {
    if (used >= MAX_CONTEXT_CHARS) break
    includedChunks++
    const remaining = MAX_CONTEXT_CHARS - used
    const piece = r.content.length > remaining ? r.content.slice(0, remaining) : r.content
    // The source travels WITH the excerpt. Retrieval always knew which page a
    // passage came from and dropped it before the prompt, so the assistant
    // could never say where an answer came from even though the answer was
    // grounded. Attaching it here is what makes a citation possible at all.
    parts.push(r.source_url ? `[source: ${r.source_url}]\n${piece}` : piece)
    used += piece.length + SEP.length
  }
  const context = parts.join(SEP)

  return {
    context,
    includedChunks,
    contextChars: context.length,
    chunks: rows.map((r) => ({
      content: r.content,
      source: r.source_url,
      score: r.similarity,
    })),
  }
}
