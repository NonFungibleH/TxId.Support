"use server"

// Shared security utilities

const PRIVATE_IP_RE = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|fc00:|fd)/

export function isPrivateUrl(raw: string): boolean {
  try {
    const { hostname } = new URL(raw)
    return PRIVATE_IP_RE.test(hostname) || hostname === "localhost"
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
