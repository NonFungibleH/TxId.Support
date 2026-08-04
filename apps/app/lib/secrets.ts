import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

/**
 * Application-layer encryption for third-party credentials.
 *
 * WHY: integration secrets live in `projects.config` JSONB. Supabase encrypts
 * at rest, but that only protects the disk. A Jira API token or GitHub PAT is a
 * broad, long-lived credential into a customer's own systems, and "it is in a
 * JSONB column" is not an answer a security reviewer accepts. Encrypting here
 * means a database dump, a mis-scoped query or a leaked read-only credential
 * does not hand over anyone's Jira.
 *
 * AES-256-GCM, so tampering is detected rather than silently decrypted.
 *
 * DEGRADES, DOES NOT BREAK: with no key configured, values pass through in
 * plaintext exactly as before, and existing plaintext values keep working
 * whether or not a key is set. Set INTEGRATION_ENCRYPTION_KEY to a base64
 * 32-byte value (`openssl rand -base64 32`) to turn it on. Rotating the key
 * without re-saving each integration will make old values unreadable, so
 * treat it as a re-save event.
 */

const PREFIX = "enc.v1."
const ALGO = "aes-256-gcm"

function key(): Buffer | null {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY
  if (!raw) return null
  try {
    const buf = Buffer.from(raw, "base64")
    return buf.length === 32 ? buf : null
  } catch {
    return null
  }
}

/** True when the value is one of ours, so plaintext is never double-encrypted. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function encryptSecret(plaintext: string): string {
  const k = key()
  if (!k || !plaintext || isEncrypted(plaintext)) return plaintext
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGO, k, iv)
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`
}

/**
 * Returns the plaintext, or the input untouched when it was never encrypted.
 * A value that looks encrypted but will not decrypt returns an empty string:
 * failing to reach Slack is better than sending a mangled token upstream.
 */
export function decryptSecret(value: string): string {
  if (!value || !isEncrypted(value)) return value
  const k = key()
  if (!k) return ""
  try {
    const [iv, tag, data] = value.slice(PREFIX.length).split(".")
    if (!iv || !tag || !data) return ""
    const decipher = createDecipheriv(ALGO, k, Buffer.from(iv, "base64url"))
    decipher.setAuthTag(Buffer.from(tag, "base64url"))
    return Buffer.concat([
      decipher.update(Buffer.from(data, "base64url")),
      decipher.final(),
    ]).toString("utf8")
  } catch {
    return ""
  }
}

/**
 * Which fields on each integration are credentials. Everything absent from
 * this map is configuration (a channel id, a repo name, a Jira project key)
 * and stays readable so the dashboard can show it back.
 */
const SECRET_FIELDS: Record<string, readonly string[]> = {
  slack: ["webhookUrl"],
  discord: ["webhookUrl"],
  telegram: [],
  linear: ["apiKey"],
  github: ["token"],
  jira: ["apiToken"],
}

function mapSecrets(
  target: string,
  cfg: Record<string, unknown>,
  fn: (v: string) => string,
): Record<string, unknown> {
  const fields = SECRET_FIELDS[target]
  if (!fields || fields.length === 0) return cfg
  const out = { ...cfg }
  for (const f of fields) {
    if (typeof out[f] === "string" && out[f]) out[f] = fn(out[f] as string)
  }
  return out
}

export const encryptIntegration = (target: string, cfg: Record<string, unknown>) =>
  mapSecrets(target, cfg, encryptSecret)

export const decryptIntegration = (target: string, cfg: Record<string, unknown>) =>
  mapSecrets(target, cfg, decryptSecret)

/** Decrypt every integration in one config blob, for the dispatch path. */
export function decryptIntegrations<T extends object>(integrations: T): T {
  const out: Record<string, unknown> = {}
  for (const [target, cfg] of Object.entries(integrations as Record<string, unknown>)) {
    out[target] =
      cfg && typeof cfg === "object"
        ? decryptIntegration(target, cfg as Record<string, unknown>)
        : cfg
  }
  return out as T
}
