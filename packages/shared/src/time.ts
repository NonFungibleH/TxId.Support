/**
 * Elapsed time, computed here so the model never computes it.
 *
 * THE BUG THIS EXISTS FOR, verbatim from the transcript. Asked at 15:19:06 what
 * their last trade was, the assistant answered "that filled about 9 minutes ago
 * at 14:09:47 UTC". The trade was right, the absolute stamp was right, and the
 * elapsed time was an hour out: comparing 14:09 to 15:19 by the minute fields
 * alone gives nine. The two halves of its own sentence disagreed.
 *
 * The rule was already established one field away, on Decibel's `feeApt`
 * ("rendered in APT, so the model never does the maths itself"). It had simply
 * never been applied to time. #77 applied it to Aptos and deliberately left the
 * other chains, so EVM (every live customer), Sui and Solana carried a bare
 * timestamp and the same arithmetic was still being done by a language model.
 *
 * This lives in @txid/shared because it is the same clock on every chain, and
 * four copies of the arithmetic is how the hour goes missing again in one of
 * them. The chain packages have no dependencies on each other by design, so
 * there was nowhere else for it to go.
 */
export function relativeAge(iso: string, nowMs: number = Date.now()): string | null {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  const diff = nowMs - t
  const future = diff < 0
  const mins = Math.floor(Math.abs(diff) / 60_000)
  const phrase = (() => {
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) {
      const rem = mins % 60
      // Hours are ALWAYS spelled out beside minutes. A dropped hour is the
      // observed failure, so no phrasing here may be able to lose one quietly.
      const h = `${hrs} hour${hrs === 1 ? "" : "s"}`
      return rem === 0 ? h : `${h} ${rem} minute${rem === 1 ? "" : "s"}`
    }
    const days = Math.floor(hrs / 24)
    return `${days} day${days === 1 ? "" : "s"}`
  })()
  if (phrase === "just now") return "just now"
  // A clock-skewed future stamp is LABELLED, never rendered as a negative age.
  return future ? `in ${phrase}` : `${phrase} ago`
}

/** Milliseconds since the epoch, from whatever the chain gave us. Null when unusable. */
export function toMillis(value: string | number | null | undefined, unit: "s" | "ms" = "ms"): number | null {
  if (value === null || value === undefined) return null
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return unit === "s" ? n * 1000 : n
}

/** `relativeAge` for a source that gives epoch time rather than an ISO string. */
export function relativeAgeFromEpoch(
  value: string | number | null | undefined,
  unit: "s" | "ms" = "ms",
  nowMs: number = Date.now(),
): string | null {
  const ms = toMillis(value, unit)
  if (ms === null) return null
  return relativeAge(new Date(ms).toISOString(), nowMs)
}
