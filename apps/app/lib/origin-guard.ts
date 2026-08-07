/**
 * Which browser origins may use a project's publishable key.
 *
 * WHY THIS IS SHARED: the chat route had this logic inline and the four
 * unauthenticated widget endpoints had none, so a key lifted from a
 * customer's page (publishable keys are always in plain HTML) could still
 * drive chain reads and ticket creation from any site on the internet. Chat
 * was guarded; the endpoints beside it were not.
 *
 * EMPTY MEANS OPEN, deliberately and unchanged: a project that has not set
 * its domains yet must keep working, or adding this guard would take live
 * widgets down. The dashboard pushes hard to get a domain set before go-live
 * instead, which is the honest place to solve it.
 */

/** Localhost is always allowed: it is how every integrator tests. */
const EXEMPT_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function hostOf(originOrReferer: string): string | null {
  try {
    return new URL(originOrReferer).hostname.toLowerCase()
  } catch {
    return null
  }
}

export function originAllowed(
  request: Request,
  allowedDomains: string[] | undefined,
  opts: { preview?: boolean; publicSurface?: boolean } = {},
): boolean {
  // Preview carries a server-signed token, checked by the caller. Public
  // surfaces (the shared demo key, publicDemo projects) are open by design:
  // they exist to be embedded anywhere, and are defended by tighter rate
  // limits and Turnstile instead.
  if (opts.preview || opts.publicSurface) return true

  const header = request.headers.get("origin") ?? request.headers.get("referer")
  const host = header ? hostOf(header) : null
  // No Origin/Referer at all: a server-to-server or privacy-stripped caller.
  // Not evidence of abuse on its own, and blocking it would break legitimate
  // integrations, so it passes here and the rate limiter carries the weight.
  if (!host || EXEMPT_HOSTS.has(host)) return true

  const allowed = allowedDomains ?? []
  if (allowed.length === 0) return true

  const normalised = allowed.map(d => d.replace(/^https?:\/\//, "").toLowerCase().replace(/\/$/, ""))
  return normalised.includes(host)
}

/** The 403 body every guarded endpoint returns, so the shape is identical. */
export function originRefused(cors: Record<string, string>): Response {
  return new Response(
    JSON.stringify({ error: "This key is not authorised for this domain." }),
    { status: 403, headers: { ...cors, "Content-Type": "application/json" } },
  )
}
