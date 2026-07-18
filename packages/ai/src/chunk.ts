/**
 * Split text into overlapping chunks suitable for embedding.
 * Targets ~400 words per chunk with ~50-word overlap.
 */
export function chunkText(
  text: string,
  maxWords = 400,
  overlapWords = 50,
): string[] {
  // Normalise line endings and split into paragraphs
  const paragraphs = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30)

  const chunks: string[] = []
  let current: string[] = [] // paragraphs in current chunk
  let wordCount = 0

  for (const para of paragraphs) {
    const words = para.split(/\s+/).length

    if (wordCount + words > maxWords && current.length > 0) {
      // Emit current chunk
      chunks.push(current.join("\n\n"))

      // Keep last N words for overlap by re-seeding from tail of current
      const tail = current.join("\n\n").split(/\s+/).slice(-overlapWords).join(" ")
      current = [tail, para]
      wordCount = overlapWords + words
    } else {
      current.push(para)
      wordCount += words
    }
  }

  if (current.length > 0) {
    chunks.push(current.join("\n\n"))
  }

  // Hard character ceiling per chunk. The word-based logic above assumes prose
  // with paragraph breaks; a JS-heavy SPA or minified page can arrive as one
  // huge whitespace-sparse blob that slips through as a single enormous chunk
  // (observed: an ingest that produced a 298k-token RAG context). Split any
  // oversized chunk by characters so no chunk — and therefore no assembled
  // context — can blow the model's window.
  const MAX_CHUNK_CHARS = 4_000
  const bounded: string[] = []
  for (const c of chunks) {
    if (c.length <= MAX_CHUNK_CHARS) {
      bounded.push(c)
    } else {
      for (let i = 0; i < c.length; i += MAX_CHUNK_CHARS) {
        bounded.push(c.slice(i, i + MAX_CHUNK_CHARS))
      }
    }
  }

  return bounded.filter((c) => c.trim().length > 60)
}
