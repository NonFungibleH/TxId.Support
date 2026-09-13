import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { listCases } from "@/lib/console/data"
import { InboxList } from "@/components/console/InboxList"
import { ConsoleUnavailable } from "@/components/console/ConsoleUnavailable"

export const metadata: Metadata = { title: "Inbox | TxID Console" }
export const dynamic = "force-dynamic"

export default async function InboxPage({ searchParams }: { searchParams?: { cause?: string; status?: string } }) {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")
  const cause = searchParams?.cause
  const status = searchParams?.status
  const r = await listCases((project as { id: string }).id, {
    ...(cause ? { cause } : {}),
    ...(status ? { status } : {}),
  })
  if (r.kind !== "ok") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">Every failed or stuck transaction across your contracts, newest first.</p>
        </div>
        <ConsoleUnavailable what="The inbox" reason={r.reason} />
      </div>
    )
  }
  return <InboxList base="/console" cases={r.value} {...(cause ? { cause } : {})} {...(status ? { status } : {})} />
}
