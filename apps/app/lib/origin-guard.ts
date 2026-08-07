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
  opts: { preview?: boolean; publicSurface?: boolean; hostPage?: string } = {},
): boolean {
  const hostPage = opts.hostPage
  // Preview carries a server-signed token, checked by the caller. Public
  // surfaces (the shared demo key, publicDemo projects) are open by design:
  // they exist to be embedded anywhere, and are defended by tighter rate
  // limits and Turnstile instead.
  if (opts.preview || opts.publicSurface) return true

  const header = request.headers.get("origin") ?? request.headers.get("referer")
  let host = header ? hostOf(header) : null

  // OUR OWN ORIGIN CARRIES NO INFORMATION, and treating it as evidence was a
  // real outage: the widget runs in an iframe on app.txid.support and fetches
  // /api/chat and /api/tickets SAME-ORIGIN, so the Origin header is always
  // ours, never the embedding site's. The moment a customer set their first
  // allowed domain, every request failed the check and the widget stopped
  // answering. The allowlist had never been set before, which is the only
  // reason this had not already happened.
  //
  // A same-origin request is therefore treated as "no usable origin" and falls
  // through to the host page reported by the embed below.
  try {
    if (host && host === new URL(request.url).hostname) host = null
  } catch { /* keep whatever we parsed */ }

  // The EMBEDDING page, reported by widget.js, which is the only party that can
  // see it. Client-supplied and therefore a soft control: it raises the bar for
  // casual key reuse, it does not stop a determined forger, and the rate limits
  // and spend guard are what bound the damage. Being honest about that is
  // better than a guard that looks strong and is bypassed by one header.
  if (!host && hostPage) host = hostOf(hostPage)
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
