import { auth } from "@clerk/nextjs/server"
import { getTeamMembers } from "@/lib/actions/team"
import { TeamInviteForm } from "@/components/dashboard/TeamInviteForm"
import { RevokeInviteButton } from "@/components/dashboard/RevokeInviteButton"
import { MemberRoleSelect } from "@/components/dashboard/MemberRoleSelect"
import { RemoveMemberButton } from "@/components/dashboard/RemoveMemberButton"
import { ROLES, ROLE_LABEL, ROLE_DESCRIPTION } from "@/lib/roles"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Users } from "lucide-react"

function roleLabel(role: string) {
  if (role === "org:admin") return "Admin"
  return "Member"
}

function initials(name: string | null, email: string) {
  if (name) return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
  return email.slice(0, 2).toUpperCase()
}

export default async function TeamPage() {
  const { orgId } = await auth()

  if (!orgId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Team</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage who has access to this project.</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Organisation required</CardTitle>
            <CardDescription className="space-y-3">
              <span className="block">
                You are signed in as an individual, so there is nobody to add yet. An organisation
                is the container colleagues join: it is what an invitation invites someone into,
                and what their role applies to.
              </span>
              <span className="block">
                Create one from the account menu at the top right, then come back here. Your
                project and every conversation move with you, and you stay its Admin.
              </span>
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const { members, pending } = await getTeamMembers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Team</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {members.length} member{members.length !== 1 ? "s" : ""}
          {pending.length > 0 ? ` · ${pending.length} pending invite${pending.length !== 1 ? "s" : ""}` : ""}
        </p>
      </div>

      {/* Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4 text-muted-foreground" />
            Invite a team member
          </CardTitle>
          <CardDescription>
            They get an email with a link to join. We ask for their work email and nothing else:
            their name arrives when they accept, and it is only used to make your change history
            readable. Choose the role deliberately, because everyone here can read your users&apos;
            conversations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TeamInviteForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What each role can do</CardTitle>
          <CardDescription>
            Enforced on the server, not just hidden in the interface. Everyone can read
            conversations and records; the difference is what they can change.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {ROLES.map((r) => (
              <li key={r} className="flex items-baseline gap-3 px-6 py-2.5">
                <span className="w-24 shrink-0 text-sm font-medium">{ROLE_LABEL[r]}</span>
                <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-6 py-3.5">
                {m.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.imageUrl} alt="" className="size-8 rounded-full object-cover" />
                ) : (
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                    {initials(m.name, m.email)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  {m.name && <p className="text-sm font-medium truncate">{m.name}</p>}
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                </div>
                <MemberRoleSelect userId={m.userId} role={m.role} isSelf={m.isSelf} />
                <RemoveMemberButton userId={m.userId} email={m.email} isSelf={m.isSelf} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Pending invitations */}
      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending invitations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {pending.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 px-6 py-3.5">
                  <div className="size-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground">
                    {initials(null, inv.email)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{inv.email}</p>
                  </div>
                  <Badge variant="outline" className="text-xs shrink-0">{roleLabel(inv.role)}</Badge>
                  <RevokeInviteButton invitationId={inv.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Separator />
      <p className="text-xs text-muted-foreground">
        Admins can manage project settings, branding, and team members. Members have read access and can view analytics and tickets.
      </p>
    </div>
  )
}
