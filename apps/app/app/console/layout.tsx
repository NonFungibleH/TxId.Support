import { redirect } from "next/navigation"
import { resolveOrg } from "@/lib/clerk-org"
import { OrgSyncGuard } from "@/components/dashboard/OrgSyncGuard"
import { MobileShell } from "@/components/dashboard/MobileShell"
import { DashboardFooter } from "@/components/dashboard/DashboardFooter"
import { getProject } from "@/lib/actions/project"
import { isCurrentUserAdmin } from "@/lib/admin-auth"
import { ensureCurrentUserRole, currentActor } from "@/lib/roles-server"
import { capabilitiesOf } from "@/lib/roles"
import { publicHost } from "@/lib/public-host"
import type { ProjectConfig } from "@/lib/types/config"

// Same reason as the dashboard: which company you are looking at comes from the
// session, so a cached shell is somebody else's shell.
export const dynamic = "force-dynamic"

/**
 * The Console runs inside the SAME shell as the rest of the product: same
 * header, same sidebar component, same footer, same theme tokens, same
 * primitives. Only the nav groups differ.
 *
 * A customer with Support and Console should feel they are in one product with
 * two sections, not two products that share a login, and anything forked here
 * is something that drifts later.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { orgId } = await resolveOrg()
  const { org, project } = await getProject()

  if (!project) redirect("/onboarding")
  await ensureCurrentUserRole()

  const actor = await currentActor()
  const caps = actor ? capabilitiesOf(actor.role) : undefined
  const typedProject = project as unknown as { mode?: string; config?: ProjectConfig }
  const plan = (typedProject.config as ProjectConfig | undefined)?.plan ?? "free"
  const isAdmin = await isCurrentUserAdmin()
  const webUrl = publicHost(process.env.NEXT_PUBLIC_WEB_URL, "https://txid.support")

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <OrgSyncGuard serverOrgId={orgId ?? null} />
      <MobileShell orgName={org.name} product="console" mode="support" caps={caps} />
      <main className="mt-14 flex-1 p-4 pb-20 md:ml-60 md:p-6 md:pb-20">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <DashboardFooter plan={plan} isAdmin={isAdmin} orgName={org.name} webUrl={webUrl} />
    </div>
  )
}
