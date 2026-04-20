/**
 * Runtime-configurable URLs.
 * Set NEXT_PUBLIC_APP_URL in Vercel environment variables if the dashboard
 * isn't yet on app.txid.support (e.g. during beta on a Vercel preview URL).
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support"
