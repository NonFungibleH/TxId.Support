import { MobileShell } from "@/components/dashboard/MobileShell"
import { DashboardFooter } from "@/components/dashboard/DashboardFooter"

export const dynamic = "force-dynamic"

/**
 * The authenticated Console layout with the auth removed, so the design can be
 * reviewed on a branch preview where Clerk cannot initialise. Same shell, same
 * sidebar component, same footer, same theme: if this ever looks different from
 * /console, the divergence is the bug.
 */
export default function ConsoleDemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <MobileShell orgName="Demo workspace" product="console" mode="support" />
      <main className="mt-14 flex-1 p-4 pb-20 md:ml-60 md:p-6 md:pb-20">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
      <DashboardFooter plan="free" isAdmin={false} orgName="Demo workspace" webUrl="https://txid.support" />
    </div>
  )
}
