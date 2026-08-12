import { redirect } from "next/navigation"
import { resolveOrg } from "@/lib/clerk-org"
import { OrgSyncGuard } from "@/components/dashboard/OrgSyncGuard"
import { MobileShell } from "@/components/dashboard/MobileShell"
import { DashboardFooter } from "@/components/dashboard/DashboardFooter"
import { getProject } from "@/lib/actions/project"
import { isCurrentUserAdmin } from "@/lib/admin-auth"
import { ensureCurrentUserRole } from "@/lib/roles-server"
import type { ProjectConfig } from "@/lib/types/config"

// Never serve this layout from a cache: which company you are looking at
// comes from the session, and a cached shell is a shell belonging to whichever
// company rendered it first.
export const dynamic = "force-dynamic"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { orgId } = await resolveOrg()
  const { org, project } = await getProject()

  if (!project) redirect("/onboarding")

  // Apply an invited member's real role before any page or action runs, so a
  // fresh invitee is never briefly treated as the default admin.
  await ensureCurrentUserRole()

  const typedProject = project as unknown as { mode?: string; config?: ProjectConfig }
  const mode = typedProject.mode ?? "support"
  const plan = (typedProject.config as ProjectConfig | undefined)?.plan ?? "free"
  // Keyed on `enabled`, NOT on activeBeta: a programme that has run its end
  // date must still be reachable, or the results vanish the day it finishes.
  const beta = (typedProject.config as ProjectConfig | undefined)?.beta?.enabled === true
  const isAdmin = await isCurrentUserAdmin()

  const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? "https://txid.support"

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OrgSyncGuard serverOrgId={orgId ?? null} />
      <MobileShell orgName={org.name} mode={mode} beta={beta} />
      <main className="mt-14 flex-1 p-4 pb-20 md:ml-60 md:p-6 md:pb-20">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
      <DashboardFooter plan={plan} isAdmin={isAdmin} orgName={org.name} webUrl={webUrl} />
    </div>
  )
}
