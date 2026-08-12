import { resolveOrg } from "@/lib/clerk-org"
import { createServiceClient } from "@/lib/supabase/server"
import { clerkClient, currentUser } from "@clerk/nextjs/server"
import {
  DEFAULT_ROLE,
  ROLE_LABEL,
  ROLES,
  isRole,
  roleCan,
  type Capability,
  type Role,
} from "@/lib/roles"

/**
 * Apply a newly-joined member's INVITED role, once.
 *
 * DEFAULT_ROLE is admin, so a member with no org_members row has FULL access
 * until their role is written. getTeamMembers writes it, but only when the Team
 * page is opened, so an invitee who went straight to the dashboard was admin in
 * the meantime, which is how a "Support" invite ended up able to change
 * everything. This writes the role from their accepted invitation on any
 * dashboard load, before they can act. Idempotent and cheap: the Clerk lookup
 * only runs when there is no row yet.
 */
export async function ensureCurrentUserRole(): Promise<void> {
  const { userId, orgId } = await resolveOrg()
  if (!userId || !orgId) return

  const supabase = createServiceClient()
  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgId)
    .maybeSingle()
  if (!org) return
  const internalOrgId = (org as { id: string }).id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing } = await (supabase as any)
    .from("org_members")
    .select("role")
    .eq("org_id", internalOrgId)
    .eq("clerk_user_id", userId)
    .maybeSingle()
  if (existing) return

  const user = await currentUser()
  // Match on ANY of the user's verified emails, not just the Clerk primary: an
  // invitee invited on their work email but whose Clerk primary is a personal
  // email would otherwise never match, get no role row, and fall through to
  // DEFAULT_ROLE = admin. (getTeamMembers uses the membership identifier for
  // the same reason.)
  const userEmails = new Set(
    (user?.emailAddresses ?? []).map((e) => e.emailAddress.toLowerCase()),
  )
  if (userEmails.size === 0) return

  const clerk = await clerkClient()
  const accepted = await clerk.organizations.getOrganizationInvitationList({
    organizationId: orgId,
    status: ["accepted"],
  })
  const inv = accepted.data.find((i) => userEmails.has(i.emailAddress.toLowerCase()))
  const role = (inv?.publicMetadata as { txidRole?: string } | undefined)?.txidRole
  if (!role || !ROLES.includes(role as Role)) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("org_members")
    .upsert(
      { org_id: internalOrgId, clerk_user_id: userId, role },
      { onConflict: "org_id,clerk_user_id" },
    )
}

/**
 * The server half of the role system.
 *
 * SPLIT FROM lib/roles.ts DELIBERATELY: the role matrix and labels are needed
 * by client components (the team page's role picker), and importing them from
 * a module that also reaches for `next/headers` pulls server-only code into
 * the browser bundle and fails the build. Constants and predicates live in
 * lib/roles.ts; anything that touches a session or the database lives here.
 */

export interface Actor {
  userId: string
  orgId: string
  role: Role
}

/**
 * The signed-in user's role in their current organisation.
 *
 * Returns null only when there is no session at all.
 */
export async function currentActor(): Promise<Actor | null> {
  const { userId, orgId } = await resolveOrg()
  if (!userId) return null
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()
  const { data: org } = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .maybeSingle()

  // NO ORG ROW YET MEANS ONBOARDING, NOT A RESTRICTED USER. `createProject`
  // is what creates the organisation, so refusing here would have thrown
  // "Unauthenticated" at every new signup. Failing closed is right when there
  // is something to protect; before the org exists there is nothing, and the
  // person creating it is by definition its first admin.
  if (!org) return { userId, orgId: "", role: DEFAULT_ROLE }
  const internalOrgId = (org as { id: string }).id

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: member } = await (supabase as any)
    .from("org_members")
    .select("role")
    .eq("org_id", internalOrgId)
    .eq("clerk_user_id", userId)
    .maybeSingle()

  // A missing row, or a table that does not exist yet, both mean "no explicit
  // role recorded", which takes the default rather than locking anyone out.
  const role = isRole(member?.role) ? member.role : DEFAULT_ROLE
  return { userId, orgId: internalOrgId, role }
}

export class ForbiddenError extends Error {
  constructor(capability: Capability, role: Role) {
    super(
      `Forbidden [requireCapability:${capability}]. ` +
      `Your role (${ROLE_LABEL[role]}) cannot do this. ` +
      `Ask an Admin${capability === "team" ? "" : ", or ask them to change your role"}.`,
    )
    this.name = "ForbiddenError"
  }
}

/**
 * Refuse unless the signed-in user's role carries this capability. Throws, so
 * a caller that forgets to check the result still fails closed.
 */
export async function requireCapability(capability: Capability): Promise<Actor> {
  const actor = await currentActor()
  if (!actor) throw new Error("Unauthenticated")
  if (!roleCan(actor.role, capability)) throw new ForbiddenError(capability, actor.role)
  return actor
}

/**
 * Every member's role, for the team page. Reads from `org_members` and fills
 * in the default for anyone with no row, so the list always reflects what the
 * server will actually enforce rather than what has been explicitly set.
 */
export async function rolesForOrg(orgId: string): Promise<Record<string, Role>> {
  if (!orgId) return {}
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("org_members")
    .select("clerk_user_id, role")
    .eq("org_id", orgId)
  if (error) return {}
  const out: Record<string, Role> = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const r of (data ?? []) as any[]) {
    if (isRole(r.role)) out[r.clerk_user_id as string] = r.role
  }
  return out
}
