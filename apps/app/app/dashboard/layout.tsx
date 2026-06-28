import { redirect } from "next/navigation"
import { MobileShell } from "@/components/dashboard/MobileShell"
import { getProject } from "@/lib/actions/project"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { org, project } = await getProject()

  if (!project) redirect("/onboarding")

  const typedProject = project as unknown as { mode?: string }
  const mode = typedProject.mode ?? "support"

  return (
    <div className="min-h-screen bg-background">
      <MobileShell orgName={org.name} mode={mode} />
      <main className="mt-14 p-4 md:ml-60 md:p-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
