/**
 * Embed text using Voyage AI voyage-3 (1024 dimensions).
 * Uses the HTTP API directly to avoid SDK version drift.
 */
export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set")

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: [text],
      model: "voyage-3",
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Voyage AI error ${response.status}: ${body}`)
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>
  }
  return data.data[0].embedding
}

/**
 * Embed multiple texts in a single API call (batch).
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.VOYAGE_API_KEY
  if (!apiKey) throw new Error("VOYAGE_API_KEY is not set")

  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: texts,
      model: "voyage-3",
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Voyage AI batch error ${response.status}: ${body}`)
  }

  const data = (await response.json()) as {
    data: Array<{ index: number; embedding: number[] }>
  }
  // Sort by index to preserve order
  return data.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding)
}
