import { Sidebar } from "@/components/dashboard/Sidebar"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { getProject } from "@/lib/actions/project"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { org, project } = await getProject()
  const typedProject = project as unknown as { mode?: string } | null
  const mode = typedProject?.mode ?? "support"

  return (
    <div className="min-h-screen bg-background">
      <Sidebar mode={mode} />
      <DashboardHeader orgName={org.name} />
      <main className="ml-60 mt-14 p-6">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
