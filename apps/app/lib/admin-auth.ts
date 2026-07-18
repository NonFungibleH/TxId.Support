import { currentUser } from "@clerk/nextjs/server"

// Single source of truth for /admin access. Emails are configured via the
// ADMIN_EMAILS env var (comma-separated). FAIL-CLOSED: if ADMIN_EMAILS is unset
// or empty, NOBODY is an admin. (The earlier per-file guards fell OPEN in that
// case — any authenticated user became an admin — so ADMIN_EMAILS must be set
// in every environment where admin access is needed, including Vercel prod.)
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .toLowerCase()
  .split(",")
  .map((e) => e.trim())
  .filter(Boolean)

/** The signed-in user's primary email, lowercased, or null if unauthenticated. */
export async function currentUserEmail(): Promise<string | null> {
  const user = await currentUser()
  return (
    user?.emailAddresses?.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase() ?? null
  )
}

/** True only when the email is present in the (non-empty) ADMIN_EMAILS allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}

/** True when the currently signed-in user is an admin. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  return isAdminEmail(await currentUserEmail())
}

/** Throws "Forbidden" unless the caller is an admin. For server actions. */
export async function assertAdmin(): Promise<void> {
  if (!(await isCurrentUserAdmin())) throw new Error("Forbidden")
}
