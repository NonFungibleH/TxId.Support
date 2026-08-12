"use server"

import { waitUntil } from "@vercel/functions"
import { ROLES, DEFAULT_ROLE, type Role } from "@/lib/roles"
import { requireCapability, rolesForOrg, currentActor } from "@/lib/roles-server"
import { isAdminEmail, isCurrentUserAdmin } from "@/lib/admin-auth"
import { createServiceClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { refuse, type ActionResult } from "@/lib/actions/result"
import { clerkClient } from "@clerk/nextjs/server"
import { resolveOrg } from "@/lib/clerk-org"

export async function getTeamMembers() {
  const { orgId } = await resolveOrg()
  if (!orgId) return { members: [], pending: [] }

  const clerk = await clerkClient()
  const [memberships, invitations, accepted] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({ organizationId: orgId }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: orgId, status: ["pending"] }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: orgId, status: ["accepted"] }),
  ])

  // The role chosen at invite time, keyed by the email it was sent to. Clerk
  // owns membership and we own permission, so there is no webhook to hang this
  // on: the role is applied the first time the team page is read after they
  // accept. Reconciling here rather than at sign-in means it also repairs
  // anyone invited while this was broken.
  const invitedRole = new Map<string, Role>()
  for (const i of accepted.data) {
    const r = (i.publicMetadata as { txidRole?: string } | undefined)?.txidRole
    if (r && ROLES.includes(r as Role)) invitedRole.set(i.emailAddress.toLowerCase(), r as Role)
  }

  // Clerk knows who is in the org; our own table knows what they may do. The
  // TxID role is what the server actually enforces, so it is what the page
  // shows, defaulting for anyone without an explicit row.
  const actor = await currentActor()
  const explicit: Record<string, Role> = actor ? await rolesForOrg(actor.orgId) : {}

  // Anyone with no explicit row but a role on their accepted invitation gets
  // that row written now, once. Without this the invited role would be shown
  // and never enforced, which is worse than not offering the choice.
  const toBackfill = memberships.data.flatMap((m) => {
    const uid = m.publicUserData?.userId
    const email = m.publicUserData?.identifier?.toLowerCase()
    if (!uid || !email || explicit[uid]) return []
    const role = invitedRole.get(email)
    return role ? [{ org_id: actor!.orgId, clerk_user_id: uid, role }] : []
  })
  if (toBackfill.length && actor) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createServiceClient() as any)
      .from("org_members")
      .upsert(toBackfill, { onConflict: "org_id,clerk_user_id" })
    // Never fail the page over this: a team list that will not load is a worse
    // failure than a role that lands on the next read.
    if (!error) for (const row of toBackfill) explicit[row.clerk_user_id] = row.role
  }

  const members = memberships.data.map((m) => {
    const uid = m.publicUserData?.userId ?? null
    return {
      id: m.id,
      userId: uid,
      email: m.publicUserData?.identifier ?? "",
      name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || null,
      imageUrl: m.publicUserData?.imageUrl ?? null,
      clerkRole: m.role as string,
      role: (uid && explicit[uid]) || DEFAULT_ROLE,
      isSelf: uid === actor?.userId,
      joinedAt: m.createdAt,
    }
  })

  const pending = invitations.data.map((i) => {
    const r = (i.publicMetadata as { txidRole?: string } | undefined)?.txidRole
    return {
      id: i.id,
      email: i.emailAddress,
      // Older invitations predate the metadata and only carry a Clerk role.
      role: (r && ROLES.includes(r as Role) ? r : i.role === "org:admin" ? "admin" : DEFAULT_ROLE) as Role,
      invitedAt: i.createdAt,
    }
  })

  // Platform operators (ADMIN_EMAILS) are hidden super-admins: they hold full
  // access to support the account, but a CUSTOMER should not see them in their
  // own team list. Hide them from everyone EXCEPT a viewer who is themselves an
  // operator, so an operator can still see and manage their own presence. The
  // member count shown in the UI derives from this list, so it follows.
  const viewerIsOperator = await isCurrentUserAdmin()
  if (viewerIsOperator) return { members, pending }
  return {
    members: members.filter(m => !isAdminEmail(m.email)),
    pending: pending.filter(p => !isAdminEmail(p.email)),
  }
}

export async function inviteTeamMember(formData: FormData): Promise<ActionResult> {
  await requireCapability("team")
  const { userId, orgId } = await resolveOrg()
  if (!userId || !orgId) throw new Error("Unauthenticated")

  const email = (formData.get("email") as string | null)?.trim()
  const role = (formData.get("role") as string | null) ?? "developer"

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return refuse("That does not look like an email address. Check it and try again.")
  }
  // THE INVITE NOW CARRIES A TxID ROLE, NOT A CLERK ONE. The form previously
  // offered Clerk's two membership levels, so three quarters of the permission
  // model was unreachable at the only moment it is natural to choose: everyone
  // arrived as Admin by default and had to be demoted afterwards, which is the
  // wrong direction to travel with access to every user conversation.
  if (!ROLES.includes(role as Role)) {
    return refuse("Pick one of the four roles before sending the invite.")
  }

  // Clerk still needs one of its OWN two roles for the membership. Only a TxID
  // Admin gets org:admin, because that is the level that can administer the
  // organisation in Clerk's own surfaces. The TxID role rides along in the
  // invitation metadata and is applied when they accept.
  const clerkRole = role === "admin" ? "org:admin" : "org:member"

  const clerk = await clerkClient()
  await clerk.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: email,
    role: clerkRole,
    publicMetadata: { txidRole: role },
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support"}/dashboard`,
    inviterUserId: userId,
  })

  revalidatePath("/dashboard/team")

  return { ok: true }
}

export async function revokeInvitation(invitationId: string) {
  await requireCapability("team")
  const { userId, orgId } = await resolveOrg()
  if (!userId || !orgId) throw new Error("Unauthenticated")

  const clerk = await clerkClient()
  await clerk.organizations.revokeOrganizationInvitation({
    organizationId: orgId,
    invitationId,
    requestingUserId: userId,
  })

  revalidatePath("/dashboard/team")
}

/**
 * Change a colleague's role.
 *
 * Two refusals worth having. You cannot change your own role, because an admin
 * demoting themselves by accident locks the organisation out of its own team
 * settings. And the last admin cannot be demoted, for the same reason with no
 * way back.
 */
export async function setMemberRole(clerkUserId: string, role: Role): Promise<ActionResult> {
  const actor = await requireCapability("team")
  if (!ROLES.includes(role)) return refuse("That is not a role we recognise.")
  if (clerkUserId === actor.userId) {
    return refuse("You cannot change your own role. Ask another Admin to do it, so an account cannot lock itself out.")
  }

  const { orgId: clerkOrgId } = await resolveOrg()
  const clerk = await clerkClient()
  const list = clerkOrgId
    ? (await clerk.organizations.getOrganizationMembershipList({ organizationId: clerkOrgId })).data
    : []
  const targetEmail = list.find(m => m.publicUserData?.userId === clerkUserId)?.publicUserData?.identifier

  // A hidden platform operator cannot be re-roled by a customer admin: that
  // would strip the vendor's support access. The UI hides operators, but the
  // action is reachable directly, so it is guarded here too.
  if (isAdminEmail(targetEmail) && !(await isCurrentUserAdmin())) {
    return refuse("You can't change that member's access.")
  }

  const supabase = createServiceClient()

  // Refuse to remove the last admin. Roles default to Admin when unset, so the
  // count considers members with no row. Operators are EXCLUDED, so this guard
  // protects the customer's OWN last admin, not the hidden operator.
  if (role !== "admin") {
    const explicit = await rolesForOrg(actor.orgId)
    const admins = list.filter(m => {
      if (isAdminEmail(m.publicUserData?.identifier)) return false
      const uid = m.publicUserData?.userId
      return uid ? (explicit[uid] ?? DEFAULT_ROLE) === "admin" : false
    })
    if (admins.length <= 1 && admins.some(m => m.publicUserData?.userId === clerkUserId)) {
      return refuse("This is the only Admin on the account. Promote someone else first, or the company loses access to its own team settings.")
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("org_members")
    .upsert(
      { org_id: actor.orgId, clerk_user_id: clerkUserId, role, updated_at: new Date().toISOString() },
      { onConflict: "org_id,clerk_user_id" },
    )
  if (error) throw new Error(error.message)

  // A permission change is the most sensitive change there is, so it is
  // recorded even though the role table itself is rewritable.
  waitUntil(recordAudit({
    action: "member.role_changed",
    target: clerkUserId,
    orgId: actor.orgId,
    metadata: { role },
  }))

  revalidatePath("/dashboard/team")

  return { ok: true }
}

/**
 * Remove someone's access.
 *
 * WHY THIS MATTERS MORE THAN THE INVITE FLOW: revoking access promptly when
 * someone leaves is a baseline expectation in any security questionnaire, and
 * until now the product could invite but not remove. Revoking a pending
 * invitation was the only path, which does nothing about somebody who has
 * already accepted and can read every conversation.
 *
 * Removes them from the Clerk organisation (membership) and drops their role
 * row (permission), so nothing is left behind to grant access if they are ever
 * re-added.
 */
export async function removeMember(clerkUserId: string): Promise<ActionResult> {
  const actor = await requireCapability("team")
  if (clerkUserId === actor.userId) {
    return refuse("You cannot remove yourself. Ask another Admin to do it.")
  }

  const { orgId } = await resolveOrg()
  if (!orgId) throw new Error("No organisation")

  const clerk = await clerkClient()
  const list = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId })
  const membership = list.data.find(m => m.publicUserData?.userId === clerkUserId)
  const email = membership?.publicUserData?.identifier ?? clerkUserId

  // A hidden platform operator cannot be removed by a customer admin: that would
  // revoke the vendor's support access. The UI hides operators, so a customer
  // never sees the control, but the action is reachable directly, so guard it.
  if (isAdminEmail(email) && !(await isCurrentUserAdmin())) {
    return refuse("You can't remove that member.")
  }

  // Refuse to remove the last Admin, for the same reason a demotion is refused:
  // it locks the organisation out of its own team settings. Operators are
  // EXCLUDED, so this protects the customer's own last admin, not the operator.
  const explicit = await rolesForOrg(actor.orgId)
  const admins = list.data.filter(m => {
    if (isAdminEmail(m.publicUserData?.identifier)) return false
    const uid = m.publicUserData?.userId
    return uid ? (explicit[uid] ?? DEFAULT_ROLE) === "admin" : false
  })
  if (admins.length <= 1 && admins.some(m => m.publicUserData?.userId === clerkUserId)) {
    throw new Error("This is the only Admin. Promote someone else first.")
  }

  await clerk.organizations.deleteOrganizationMembership({ organizationId: orgId, userId: clerkUserId })

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("org_members")
    .delete()
    .eq("org_id", actor.orgId)
    .eq("clerk_user_id", clerkUserId)

  // Dated, and it names them: "when did X lose access" is the question an
  // auditor asks, and it is unanswerable from a deleted row.
  waitUntil(recordAudit({
    action: "member.removed",
    target: email,
    orgId: actor.orgId,
    metadata: { removedUserId: clerkUserId },
  }))

  revalidatePath("/dashboard/team")

  return { ok: true }
}
