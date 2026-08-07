import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { isCurrentUserAdmin } from "@/lib/admin-auth"

/**
 * What the SERVER actually sees for the current session.
 *
 * WHY THIS EXISTS: switching organisation kept showing the previous company's
 * data, and two rounds of reading the code could not settle whether `orgId`
 * was reaching the server or whether the org-to-project resolution was wrong.
 * Guessing a third fix would have been a third guess. This answers it in one
 * request, and the two possibilities look completely different here:
 *
 *   orgId: null while the switcher shows a company  -> the active organisation
 *     is not in the session token. A Clerk instance problem, not ours.
 *   orgId: "org_..." with the wrong project         -> our resolution is wrong.
 *
 * ADMIN ONLY, and it returns identifiers rather than any customer content.
 */
export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    })
  }

  const { userId, orgId, orgSlug, orgRole, sessionClaims } = await auth()
  const orgKey = orgId ?? userId
  const supabase = createServiceClient()

  const { data: org } = await supabase
    .from("organisations")
    .select("id, name, clerk_org_id")
    .eq("clerk_org_id", orgKey ?? "")
    .maybeSingle()

  const orgRow = org as unknown as { id: string; name: string; clerk_org_id: string } | null

  const { data: projects } = orgRow
    ? await supabase.from("projects").select("id, name").eq("org_id", orgRow.id)
    : { data: null }

  return new Response(
    JSON.stringify(
      {
        session: { userId, orgId: orgId ?? null, orgSlug: orgSlug ?? null, orgRole: orgRole ?? null },
        resolvedWith: orgId ? "organisation" : "personal (orgId was null)",
        // THE RAW TOKEN CLAIMS, because two rounds of hypothesising did not
        // settle why orgId is absent. If the org data is present here under a
        // claim the SDK is not reading (e.g. an "o" object rather than
        // top-level org_id), the fix is an SDK upgrade, not a Clerk migration.
        tokenClaimKeys: Object.keys((sessionClaims ?? {}) as Record<string, unknown>),
        orgShapedClaims: Object.fromEntries(
          Object.entries((sessionClaims ?? {}) as Record<string, unknown>)
            .filter(([k]) => k === "o" || k.startsWith("org"))
        ),
        orgKey,
        organisationRow: orgRow,
        projects: (projects ?? []) as unknown as Array<{ id: string; name: string }>,
      },
      null,
      2,
    ),
    { headers: { "Content-Type": "application/json" } },
  )
}
