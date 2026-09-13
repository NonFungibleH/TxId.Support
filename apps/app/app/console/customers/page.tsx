import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { listCustomers, resolveSearchTarget } from "@/lib/console/data"
import { CustomerDirectory } from "@/components/console/CustomerDirectory"
import { ConsoleUnavailable } from "@/components/console/ConsoleUnavailable"

export const metadata: Metadata = { title: "Customers | TxID Console" }
export const dynamic = "force-dynamic"

export default async function CustomersPage({ searchParams }: { searchParams?: { q?: string } }) {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")
  const projectId = (project as { id: string }).id
  const q = searchParams?.q
  if (q) {
    const target = await resolveSearchTarget(projectId, q)
    if (target) redirect(`/console${target}`)
  }
  const r = await listCustomers(projectId, q)
  if (r.kind !== "ok") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">Everyone who has interacted with your contracts.</p>
        </div>
        <ConsoleUnavailable what="The customer list" reason={r.reason} />
      </div>
    )
  }
  return <CustomerDirectory base="/console" customers={r.value} {...(q ? { q } : {})} />
}
