/**
 * Runtime-configurable URLs.
 * Set NEXT_PUBLIC_APP_URL in Vercel environment variables if the dashboard
 * isn't yet on app.txid.support (e.g. during beta on a Vercel preview URL).
 *
 * A *.vercel.app value is deliberately ignored: those deployment domains sit
 * behind Vercel Deployment Protection and 302-redirect to a login, which breaks
 * anything a public visitor loads from them (the /d/ share page's widget.js, the
 * widget-config fetch). Fall back to the stable custom domain in that case.
 */
function publicHost(url: string | undefined, fallback: string): string {
  if (!url) return fallback
  try {
    if (/\.vercel\.app$/i.test(new URL(url).hostname)) return fallback
    return url.replace(/\/$/, "")
  } catch {
    return fallback
  }
}

export const APP_URL = publicHost(process.env.NEXT_PUBLIC_APP_URL, "https://app.txid.support")
