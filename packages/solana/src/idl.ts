/** Fetch Anchor IDL for a program from the public registry. Returns null if not found. */
export async function fetchIdlFromRegistry(programAddress: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://anchor.projectserum.com/idl/${programAddress}`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return null
    const data = (await res.json()) as unknown
    if (!data || typeof data !== "object") return null
    return JSON.stringify(data)
  } catch {
    return null
  }
}
