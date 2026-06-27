import { auth } from "@clerk/nextjs/server"
import { getTeamMembers } from "@/lib/actions/team"
import { TeamInviteForm } from "@/components/dashboard/TeamInviteForm"
import { RevokeInviteButton } from "@/components/dashboard/RevokeInviteButton"
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
            <CardDescription>
              Team collaboration requires an organisation. Create one in your account settings to invite colleagues.
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
          <CardDescription>They&apos;ll receive an email with a link to join your organisation.</CardDescription>
        </CardHeader>
        <CardContent>
          <TeamInviteForm />
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
                <Badge variant="secondary" className="text-xs shrink-0">
                  {roleLabel(m.role)}
                </Badge>
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
