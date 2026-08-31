import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { waitUntil } from "@vercel/functions"
import { getProject } from "@/lib/actions/project"
import { recordCaseAccess } from "@/lib/case-access"
import { customerById } from "@/lib/console/fixtures"
import { CustomerProfile } from "@/components/console/CustomerProfile"

export const metadata: Metadata = { title: "Customer | TxID Console" }
export const dynamic = "force-dynamic"

export default async function CustomerPage({ params }: { params: { id: string } }) {
  const customer = customerById(params.id)
  if (!customer) notFound()

  // Reading a customer's case record is itself an event a reviewer will ask
  // about. Fire-and-forget so it never delays or breaks the page; the review
  // copy at /console-demo never reaches this file.
  const { project } = await getProject()
  if (project) {
    waitUntil(recordCaseAccess({
      projectId: (project as { id: string }).id,
      actor: (await auth()).userId ?? "unknown",
      action: "view",
      detail: { surface: "console", entity: `customer:${params.id}` },
    }))
  }
  return <CustomerProfile base="/console" customer={customer} />
}
