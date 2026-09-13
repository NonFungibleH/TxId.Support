import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { auth } from "@clerk/nextjs/server"
import { waitUntil } from "@vercel/functions"
import { getProject } from "@/lib/actions/project"
import { recordCaseAccess } from "@/lib/case-access"
import { caseViewById } from "@/lib/console/data"
import { CaseDetail } from "@/components/console/CaseDetail"
import { ConsoleUnavailable } from "@/components/console/ConsoleUnavailable"

export const metadata: Metadata = { title: "Case | TxID Console" }
export const dynamic = "force-dynamic"

export default async function CasePage({ params }: { params: { caseId: string } }) {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")
  const projectId = (project as { id: string }).id

  const r = await caseViewById(projectId, params.caseId)
  // A read that did not complete is not a case that does not exist.
  if (r.kind !== "ok") return <ConsoleUnavailable what="This case" reason={r.reason} />
  if (!r.value) notFound()

  // Reading a customer's case record is itself an event a reviewer will ask
  // about. Fire-and-forget so it never delays or breaks the page; the review
  // copy at /console-demo never reaches this file.
  waitUntil(recordCaseAccess({
    projectId,
    actor: (await auth()).userId ?? "unknown",
    action: "view",
    detail: { surface: "console", entity: `case:${params.caseId}` },
  }))
  return <CaseDetail base="/console" view={r.value} />
}
