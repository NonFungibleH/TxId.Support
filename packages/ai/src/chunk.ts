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

  return chunks.filter((c) => c.trim().length > 60)
}
