import { createHash } from "crypto"
import { getAptosNetworkStatus } from "@txid/aptos"

/**
 * The conditions an answer was produced under.
 *
 * The case record already holds the question, the answer and the investigation.
 * A reviewer's next question is "under what conditions was this said, and can I
 * reproduce it?", which needs the chain state and request context the answer
 * rested on.
 *
 * PRIVACY: no raw IP is stored. Vercel resolves country at the edge and the IP
 * is discarded here, because an IP is personal data under GDPR and would pull
 * retention and subject-access duties onto a field only needed at country
 * granularity. The device fields come from what the browser already announces
 * in its user agent, coarsened to a platform and a browser family. Nothing
 * fingerprints.
 */
import type { EvidenceSource } from "@txid/ai"

export interface AnswerEvidence {
  /** Chain state the answer rested on, so it can be replayed. */
  chain?: { chainId: string; ledgerVersion?: string; readAt: string }
  request?: {
    country?: string
    region?: string
    surface?: string
    language?: string
    deviceType?: "mobile" | "tablet" | "desktop"
    platform?: string
    browser?: string
  }
  model?: { name?: string; promptVersion?: string }
  investigation?: { toolsUsed?: string[]; failedLookups?: string[] }
  /**
   * What the documentation search actually returned.
   *
   * WHY: a weak answer caused by documentation that does not cover the topic
   * and one caused by documentation that covers it badly are identical in a
   * transcript, and have opposite fixes: write a new page, or fix the page you
   * have. `matched: 0` is the first, a low `topScore` is the second. Without
   * this the whole knowledge half of the gaps view is guesswork.
   *
   * `contextChars` is here for a second reason: it is prompt spend. Every
   * character is paid for on every message, so seeing it next to the score
   * that earned it is what makes the retrieval budget tunable rather than a
   * number somebody picked once.
   */
  retrieval?: {
    /** Chunks above the similarity threshold. 0 means the docs did not cover it. */
    matched: number
    /** Best similarity, 0 to 1. Present only when something matched. */
    topScore?: number
    /** Chunks cut by the character budget, so a miss is never blamed on the docs. */
    dropped?: number
    /** Characters of documentation sent to the model. */
    contextChars?: number
    /** Pages the answer could draw on, deduplicated. */
    sources?: string[]
  }
  /**
   * Every named thing the answer rested on, in one list.
   *
   * The other fields say what KIND of investigation happened; this says what
   * it actually touched, so a reviewer can go and look at the same documents,
   * contracts, transactions and prices rather than take the summary on trust.
   */
  sources?: EvidenceSource[]
  /**
   * How well founded the answer was, computed from what actually happened
   * rather than asked of the model.
   *
   * `verified`   at least one live read succeeded
   * `documented` the documentation matched, nothing was read from chain
   * `ungrounded` neither. The model answered from its own knowledge, which on
   *              a compliance surface is the case a protocol most needs to see
   *
   * DELIBERATELY NOT SELF-REPORTED. A model asked to rate its own confidence
   * will say it is confident, and the one answer you need flagged is exactly
   * the one it feels sure about.
   */
  grounding?: "verified" | "documented" | "ungrounded"
  answer?: { sha256: string; characters: number }
  latencyMs?: number
}

/**
 * Coarse device facts from the user agent. A support team needs "was this a
 * phone?" to judge a UI complaint; nobody needs a fingerprint, so this
 * deliberately stops at family level and never combines fields into an id.
 */
export function coarseDevice(userAgent: string | null): {
  deviceType?: "mobile" | "tablet" | "desktop"
  platform?: string
  browser?: string
} {
  if (!userAgent) return {}
  const ua = userAgent.toLowerCase()

  const deviceType: "mobile" | "tablet" | "desktop" =
    /ipad|tablet/.test(ua) ? "tablet" : /mobi|android|iphone/.test(ua) ? "mobile" : "desktop"

  const platform =
    /iphone|ipad|ipod/.test(ua) ? "iOS"
    : /android/.test(ua) ? "Android"
    : /mac os/.test(ua) ? "macOS"
    : /windows/.test(ua) ? "Windows"
    : /linux/.test(ua) ? "Linux"
    : undefined

  // Order matters: Edge and Chrome both claim Safari, Chrome claims Safari too.
  const browser =
    /edg\//.test(ua) ? "Edge"
    : /opr\/|opera/.test(ua) ? "Opera"
    : /firefox/.test(ua) ? "Firefox"
    : /chrome|crios/.test(ua) ? "Chrome"
    : /safari/.test(ua) ? "Safari"
    : undefined

  return { deviceType, ...(platform ? { platform } : {}), ...(browser ? { browser } : {}) }
}

/**
 * Country and region as resolved at the edge. Vercel sets these headers; the
 * IP itself is never read here, so it cannot be persisted by accident.
 */
export function requestGeo(headers: Headers): { country?: string; region?: string } {
  const country = headers.get("x-vercel-ip-country") ?? undefined
  const region = headers.get("x-vercel-ip-country-region") ?? undefined
  return { ...(country ? { country } : {}), ...(region ? { region } : {}) }
}

/**
 * The ledger version an answer was true as of. This is what makes a claim
 * reproducible: an auditor can replay the exact chain state behind it rather
 * than taking the answer's word for it. Read after the response is already
 * streamed, so it costs the user nothing.
 */
export async function chainStateAt(chainId?: string): Promise<AnswerEvidence["chain"]> {
  if (!chainId) return undefined
  const readAt = new Date().toISOString()
  if (chainId !== "aptos") return { chainId, readAt }
  try {
    const status = await getAptosNetworkStatus()
    const version = status?.latestVersion
    return { chainId, readAt, ...(version ? { ledgerVersion: String(version) } : {}) }
  } catch {
    return { chainId, readAt }
  }
}

/** Tamper evidence for the stored answer, without duplicating it. */
export function answerFingerprint(text: string): { sha256: string; characters: number } {
  return { sha256: createHash("sha256").update(text).digest("hex"), characters: text.length }
}

/** Transaction hashes are 0x + 64 hex on both EVM and Aptos. */
const HASH_RE = /0x[a-fA-F0-9]{64}/g

/**
 * Hashes the USER pasted, as distinct from ones we found.
 *
 * WHY THE DISTINCTION IS RECORDED: a hash the user supplied is a claim about
 * their own history; one we looked up is a finding of ours. Merging them into
 * "transactions consulted" misrepresents who asserted what, which is the exact
 * thing a dispute turns on.
 */
export function userSuppliedHashes(text: string, chainId?: string): EvidenceSource[] {
  const out: EvidenceSource[] = []
  const seen = new Set<string>()
  for (const m of text.matchAll(HASH_RE)) {
    const hash = m[0]
    if (seen.has(hash.toLowerCase())) continue
    seen.add(hash.toLowerCase())
    out.push({ kind: "transaction", hash, origin: "user_supplied", ...(chainId ? { chain: chainId } : {}) })
    if (out.length >= 5) break
  }
  return out
}

/**
 * Which documentation pages an answer used, pinned to the version that was
 * live at the time. `content_hash` is what makes "documentation vX" real: it
 * identifies the exact text, and `doc_sources` already tracks it for change
 * detection, so the version is a by-product rather than a new concept.
 */
export async function documentationSources(
  supabase: { from: (t: string) => never } | ReturnType<typeof import("@/lib/supabase/server").createServiceClient>,
  projectId: string,
  urls: string[],
): Promise<EvidenceSource[]> {
  if (urls.length === 0) return []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("doc_sources")
      .select("url, content_hash, last_changed_at")
      .eq("project_id", projectId)
      .in("url", urls.slice(0, 8))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const byUrl = new Map(((data ?? []) as any[]).map(r => [r.url as string, r]))
    return urls.slice(0, 8).map(url => {
      const row = byUrl.get(url)
      return {
        kind: "documentation" as const,
        url,
        // Short hash: enough to pin a version, short enough to read in a table.
        ...(row?.content_hash ? { version: String(row.content_hash).slice(0, 12) } : {}),
        ...(row?.last_changed_at ? { changedAt: row.last_changed_at } : {}),
      }
    })
  } catch {
    // A missing doc_sources row means the page predates change tracking, so the
    // URL is still worth recording without a version.
    return urls.slice(0, 8).map(url => ({ kind: "documentation" as const, url }))
  }
}
