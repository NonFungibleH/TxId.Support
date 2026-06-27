/**
 * Embed text using Cohere embed-english-v3.0 (1024 dimensions, free tier — 100 RPM).
 * Falls back to Voyage AI if VOYAGE_API_KEY is set and COHERE_API_KEY is not.
 */

async function cohereEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.COHERE_API_KEY!
  const response = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      texts,
      model: "embed-english-v3.0",
      input_type: "search_document",
      embedding_types: ["float"],
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Cohere embed error ${response.status}: ${body}`)
  }
  const data = (await response.json()) as { embeddings: { float: number[][] } }
  return data.embeddings.float
}

async function cohereEmbedQuery(text: string): Promise<number[]> {
  const apiKey = process.env.COHERE_API_KEY!
  const response = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      texts: [text],
      model: "embed-english-v3.0",
      input_type: "search_query",
      embedding_types: ["float"],
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Cohere embed error ${response.status}: ${body}`)
  }
  const data = (await response.json()) as { embeddings: { float: number[][] } }
  return data.embeddings.float[0]
}

async function voyageEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY!
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: "voyage-3" }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Voyage AI batch error ${response.status}: ${body}`)
  }
  const data = (await response.json()) as { data: Array<{ index: number; embedding: number[] }> }
  return data.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}

export async function embedText(text: string): Promise<number[]> {
  if (process.env.COHERE_API_KEY) {
    return cohereEmbedQuery(text)
  }
  if (!process.env.VOYAGE_API_KEY) throw new Error("No embedding API key set (COHERE_API_KEY or VOYAGE_API_KEY)")
  const rows = await voyageEmbed([text])
  return rows[0]
}

export async function embedBatch(texts: string[]): Promise<number[][]> {
  console.log('[embed] COHERE set:', !!process.env.COHERE_API_KEY, '| VOYAGE set:', !!process.env.VOYAGE_API_KEY)
  if (process.env.COHERE_API_KEY) {
    // Cohere max 96 texts per call
    const BATCH = 96
    const results: number[][] = []
    for (let i = 0; i < texts.length; i += BATCH) {
      const rows = await cohereEmbed(texts.slice(i, i + BATCH))
      results.push(...rows)
    }
    return results
  }
  if (!process.env.VOYAGE_API_KEY) throw new Error("No embedding API key set (COHERE_API_KEY or VOYAGE_API_KEY)")
  return voyageEmbed(texts)
}
