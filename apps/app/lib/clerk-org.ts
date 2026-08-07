import { auth } from "@clerk/nextjs/server"

/**
 * The active organisation, read from the session token the way THIS instance
 * actually issues it.
 *
 * WHY THIS EXISTS: `auth().orgId` returns null even with an organisation
 * active. Clerk now issues a versioned session token that carries organisation
 * data in an `o` claim:
 *
 *   { "v": 2, "o": { "id": "org_...", "rol": "admin", "slg": "acme" }, ... }
 *
 * `@clerk/nextjs` 5.7.5 reads a top-level `org_id`, finds nothing, and reports
 * no active organisation. The client SDK reads organisation state directly
 * rather than from the token, so it knew perfectly well which company was
 * selected: hence a switcher showing Acme while the server served someone
 * else's dashboard.
 *
 * Verified against a real token via /api/whoami before writing this, after two
 * wrong hypotheses (router cache, then a development-instance problem) that
 * would each have cost a day.
 *
 * DELETE THIS when @clerk/nextjs is upgraded to v6, which reads the claim
 * natively. It is a shim for a version gap, not a design.
 */
export async function resolveOrg(): Promise<{
  userId: string | null
  orgId: string | null
  orgSlug: string | null
  orgRole: string | null
}> {
  const { userId, orgId, orgSlug, orgRole, sessionClaims } = await auth()

  // Trust the SDK first: on a version that parses the claim this is already
  // correct, and the shim below then never runs.
  if (orgId) return { userId, orgId, orgSlug: orgSlug ?? null, orgRole: orgRole ?? null }

  const o = (sessionClaims as { o?: { id?: string; slg?: string; rol?: string } } | undefined)?.o
  if (o?.id) {
    return { userId, orgId: o.id, orgSlug: o.slg ?? null, orgRole: o.rol ?? null }
  }

  // No active organisation. Genuinely the personal account, not a parse
  // failure, so callers fall back to the user id as before.
  return { userId, orgId: null, orgSlug: null, orgRole: null }
}

/**
 * The key every tenant-scoped row is stored under: the organisation when one
 * is active, otherwise the user's own id for their personal workspace.
 */
export async function orgKey(): Promise<{ userId: string; orgKey: string; orgSlug: string | null }> {
  const { userId, orgId, orgSlug } = await resolveOrg()
  if (!userId) throw new Error("Unauthenticated")
  return { userId, orgKey: orgId ?? userId, orgSlug }
}
