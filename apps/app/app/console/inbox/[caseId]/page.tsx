import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { waitUntil } from "@vercel/functions"
import { getProject } from "@/lib/actions/project"
import { recordCaseAccess } from "@/lib/case-access"
import { caseById } from "@/lib/console/fixtures"
import { CaseDetail } from "@/components/console/CaseDetail"

export const metadata: Metadata = { title: "Case | TxID Console" }
export const dynamic = "force-dynamic"

export default async function CasePage({ params }: { params: { caseId: string } }) {
  const hit = caseById(params.caseId)
  if (!hit) notFound()

  // Reading a customer's case record is itself an event a reviewer will ask
  // about. Fire-and-forget so it never delays or breaks the page; the review
  // copy at /console-demo never reaches this file.
  const { project } = await getProject()
  if (project) {
    waitUntil(recordCaseAccess({
      projectId: (project as { id: string }).id,
      actor: (await auth()).userId ?? "unknown",
      action: "view",
      detail: { surface: "console", entity: `case:${params.caseId}` },
    }))
  }
  return <CaseDetail base="/console" customer={hit.customer} interaction={hit.interaction} />
}
