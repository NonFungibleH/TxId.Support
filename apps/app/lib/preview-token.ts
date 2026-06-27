import crypto from "crypto"

function secret(): string {
  // Reuse the service-role key as HMAC secret — it is never exposed client-side
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? "dev-preview-secret"
}

export function generatePreviewToken(projectId: string): string {
  return crypto.createHmac("sha256", secret()).update(projectId).digest("hex").slice(0, 24)
}

export function verifyPreviewToken(projectId: string, token: string | null | undefined): boolean {
  if (!token) return false
  return token === generatePreviewToken(projectId)
}
