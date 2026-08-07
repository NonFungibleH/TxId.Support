"use server"

import { ROLES, DEFAULT_ROLE, type Role } from "@/lib/roles"
import { requireCapability, rolesForOrg, currentActor } from "@/lib/roles-server"
import { createServiceClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"
import { revalidatePath } from "next/cache"
import { clerkClient } from "@clerk/nextjs/server"
import { resolveOrg } from "@/lib/clerk-org"

export async function getTeamMembers() {
  const { orgId } = await resolveOrg()
  if (!orgId) return { members: [], pending: [] }

  const clerk = await clerkClient()
  const [memberships, invitations] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({ organizationId: orgId }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: orgId, status: ["pending"] }),
  ])

  // Clerk knows who is in the org; our own table knows what they may do. The
  // TxID role is what the server actually enforces, so it is what the page
  // shows, defaulting for anyone without an explicit row.
  const actor = await currentActor()
  const explicit = actor ? await rolesForOrg(actor.orgId) : {}

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

  const pending = invitations.data.map((i) => ({
    id: i.id,
    email: i.emailAddress,
    role: i.role as string,
    invitedAt: i.createdAt,
  }))

  return { members, pending }
}

export async function inviteTeamMember(formData: FormData) {
  await requireCapability("team")
  const { userId, orgId } = await resolveOrg()
  if (!userId || !orgId) throw new Error("Unauthenticated")

  const email = (formData.get("email") as string | null)?.trim()
  const role = (formData.get("role") as string | null) ?? "org:member"

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Valid email required")
  }
  if (!["org:admin", "org:member"].includes(role)) {
    throw new Error("Invalid role")
  }

  const clerk = await clerkClient()
  await clerk.organizations.createOrganizationInvitation({
    organizationId: orgId,
    emailAddress: email,
    role,
    redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.txid.support"}/dashboard`,
    inviterUserId: userId,
  })

  revalidatePath("/dashboard/team")
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
export async function setMemberRole(clerkUserId: string, role: Role): Promise<void> {
  const actor = await requireCapability("team")
  if (!ROLES.includes(role)) throw new Error("Unknown role")
  if (clerkUserId === actor.userId) {
    throw new Error("You cannot change your own role. Ask another Admin.")
  }

  const supabase = createServiceClient()

  // Refuse to remove the last admin. Roles default to Admin when unset, so the
  // count has to consider members with no row, which is why it is computed
  // from the Clerk member list rather than from this table alone.
  if (role !== "admin") {
    const { orgId: clerkOrgId } = await resolveOrg()
    if (clerkOrgId) {
      const clerk = await clerkClient()
      const list = await clerk.organizations.getOrganizationMembershipList({ organizationId: clerkOrgId })
      const explicit = await rolesForOrg(actor.orgId)
      const admins = list.data.filter(m => {
        const uid = m.publicUserData?.userId
        return uid ? (explicit[uid] ?? DEFAULT_ROLE) === "admin" : false
      })
      if (admins.length <= 1 && admins.some(m => m.publicUserData?.userId === clerkUserId)) {
        throw new Error("This is the only Admin. Promote someone else first.")
      }
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
  void recordAudit({
    action: "member.role_changed",
    target: clerkUserId,
    orgId: actor.orgId,
    metadata: { role },
  })

  revalidatePath("/dashboard/team")
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
export async function removeMember(clerkUserId: string): Promise<void> {
  const actor = await requireCapability("team")
  if (clerkUserId === actor.userId) {
    throw new Error("You cannot remove yourself. Ask another Admin.")
  }

  const { orgId } = await resolveOrg()
  if (!orgId) throw new Error("No organisation")

  // Refuse to remove the last Admin, for the same reason a demotion is
  // refused: it locks the organisation out of its own team settings.
  const clerk = await clerkClient()
  const list = await clerk.organizations.getOrganizationMembershipList({ organizationId: orgId })
  const explicit = await rolesForOrg(actor.orgId)
  const admins = list.data.filter(m => {
    const uid = m.publicUserData?.userId
    return uid ? (explicit[uid] ?? DEFAULT_ROLE) === "admin" : false
  })
  if (admins.length <= 1 && admins.some(m => m.publicUserData?.userId === clerkUserId)) {
    throw new Error("This is the only Admin. Promote someone else first.")
  }

  const membership = list.data.find(m => m.publicUserData?.userId === clerkUserId)
  const email = membership?.publicUserData?.identifier ?? clerkUserId

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
  void recordAudit({
    action: "member.removed",
    target: email,
    orgId: actor.orgId,
    metadata: { removedUserId: clerkUserId },
  })

  revalidatePath("/dashboard/team")
}
