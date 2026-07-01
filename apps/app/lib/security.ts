// Shared security utilities — pure helpers, no "use server" needed

const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0$|::1$|fc00:|fd|fe80:)/

// Well-known cloud metadata and loopback hostnames not covered by the IP regex
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "metadata.google.internal",
  "metadata.azure.internal",
])

export function isPrivateUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw)
    const h = hostname.toLowerCase()
    return PRIVATE_IP_RE.test(h) || BLOCKED_HOSTNAMES.has(h)
  } catch {
    return true // unparseable = blocked
  }
}

export function assertSafeWebhookUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("Invalid webhook URL")
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS")
  }
  if (isPrivateUrl(url)) {
    throw new Error("Webhook URL must be a public address")
  }
}
