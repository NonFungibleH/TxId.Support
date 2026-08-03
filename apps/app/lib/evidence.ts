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
