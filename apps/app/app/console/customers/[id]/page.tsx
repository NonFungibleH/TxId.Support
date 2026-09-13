import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { waitUntil } from "@vercel/functions"
import { getProject } from "@/lib/actions/project"
import { recordCaseAccess } from "@/lib/case-access"
import { customerView } from "@/lib/console/data"
import { CustomerProfile } from "@/components/console/CustomerProfile"
import { ConsoleUnavailable } from "@/components/console/ConsoleUnavailable"

export const metadata: Metadata = { title: "Customer | TxID Console" }
export const dynamic = "force-dynamic"

export default async function CustomerPage({ params }: { params: { id: string } }) {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")
  const projectId = (project as { id: string }).id
  const id = decodeURIComponent(params.id)

  const r = await customerView(projectId, id)
  if (r.kind !== "ok") return <ConsoleUnavailable what="This customer" reason={r.reason} />
  if (!r.value) notFound()

  waitUntil(recordCaseAccess({
    projectId,
    actor: (await auth()).userId ?? "unknown",
    action: "view",
    detail: { surface: "console", entity: `customer:${id}` },
  }))
  return <CustomerProfile base="/console" customer={r.value} />
}
