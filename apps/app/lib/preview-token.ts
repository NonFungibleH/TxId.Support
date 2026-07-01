import crypto from "crypto"

function secret(): string {
  const s = process.env.PREVIEW_HMAC_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!s) throw new Error("PREVIEW_HMAC_SECRET is not configured")
  return s
}

export function generatePreviewToken(projectId: string): string {
  return crypto.createHmac("sha256", secret()).update(projectId).digest("hex").slice(0, 24)
}

export function verifyPreviewToken(projectId: string, token: string | null | undefined): boolean {
  if (!token) return false
  const expected = generatePreviewToken(projectId)
  // Constant-time comparison to prevent timing attacks
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))
}
