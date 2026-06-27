"use server"

import { auth, clerkClient } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"

export async function getTeamMembers() {
  const { orgId } = await auth()
  if (!orgId) return { members: [], pending: [] }

  const clerk = await clerkClient()
  const [memberships, invitations] = await Promise.all([
    clerk.organizations.getOrganizationMembershipList({ organizationId: orgId }),
    clerk.organizations.getOrganizationInvitationList({ organizationId: orgId, status: ["pending"] }),
  ])

  const members = memberships.data.map((m) => ({
    id: m.id,
    email: m.publicUserData?.identifier ?? "",
    name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" ") || null,
    imageUrl: m.publicUserData?.imageUrl ?? null,
    role: m.role as string,
    joinedAt: m.createdAt,
  }))

  const pending = invitations.data.map((i) => ({
    id: i.id,
    email: i.emailAddress,
    role: i.role as string,
    invitedAt: i.createdAt,
  }))

  return { members, pending }
}

export async function inviteTeamMember(formData: FormData) {
  const { userId, orgId } = await auth()
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
  const { userId, orgId } = await auth()
  if (!userId || !orgId) throw new Error("Unauthenticated")

  const clerk = await clerkClient()
  await clerk.organizations.revokeOrganizationInvitation({
    organizationId: orgId,
    invitationId,
    requestingUserId: userId,
  })

  revalidatePath("/dashboard/team")
}
