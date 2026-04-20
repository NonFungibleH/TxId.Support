import { Sidebar } from "@/components/dashboard/Sidebar"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { getProject } from "@/lib/actions/project"
import Link from "next/link"

const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? "https://txid.support"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { org, project } = await getProject()
  const typedProject = project as unknown as { mode?: string } | null
  const mode = typedProject?.mode ?? "support"

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Sidebar mode={mode} />
      <DashboardHeader orgName={org.name} />
      <main className="ml-60 mt-14 p-6 flex-1">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>

      {/* Footer */}
      <footer className="ml-60 border-t border-border px-6 py-4">
        <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} TxID Support
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <a href={`${WEB_URL}/terms`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              Terms
            </a>
            <a href={`${WEB_URL}/privacy`} target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-colors">
              Privacy
            </a>
            <a href="mailto:hello@txid.support" className="hover:text-foreground transition-colors">
              Contact
            </a>
            <Link href="/" className="hover:text-foreground transition-colors">
              txid.support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
