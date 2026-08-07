import { redirect } from "next/navigation"
import { resolveOrg } from "@/lib/clerk-org"
import { OrgSyncGuard } from "@/components/dashboard/OrgSyncGuard"
import { MobileShell } from "@/components/dashboard/MobileShell"
import { getProject } from "@/lib/actions/project"
import { isCurrentUserAdmin } from "@/lib/admin-auth"
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
      <MobileShell orgName={org.name} mode={mode} plan={plan} isAdmin={isAdmin} beta={beta} />
      <main className="mt-14 flex-1 p-4 md:ml-60 md:p-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
      <footer className="border-t border-border md:ml-60">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-xs text-muted-foreground md:px-6">
          <span>© {new Date().getFullYear()} TxID</span>
          <span className="opacity-40">·</span>
          <a href={`${webUrl}/docs`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Docs</a>
          <span className="opacity-40">·</span>
          <a href={`${webUrl}/terms`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Terms</a>
          <span className="opacity-40">·</span>
          <a href={`${webUrl}/privacy`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Privacy</a>
          <span className="opacity-40">·</span>
          <a href="mailto:team@txid.support" className="hover:text-foreground transition-colors">Contact</a>
          <span className="opacity-40">·</span>
          <a href="https://t.me/Non_Fungible_Howard" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">Telegram</a>
        </div>
      </footer>
    </div>
  )
}
