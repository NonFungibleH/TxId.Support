/**
 * A public-facing base URL that is never a Vercel preview host.
 *
 * NEXT_PUBLIC_WEB_URL (and friends) can be set to the project's *.vercel.app
 * deployment URL, which then leaks into customer-facing links — the dashboard
 * footer's Docs / Terms / Privacy pointed at
 * `https://tx-id-support-…vercel.app/docs` instead of the live domain. Fall
 * back to the canonical host whenever the configured value is a vercel.app host,
 * empty, or unparseable. A trailing slash is trimmed so `${host}/docs` is clean.
 */
export function publicHost(url: string | undefined, fallback: string): string {
  if (!url) return fallback
  try {
    if (/\.vercel\.app$/i.test(new URL(url).hostname)) return fallback
    return url.replace(/\/$/, "")
  } catch {
    return fallback
  }
}
