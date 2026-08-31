import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { caseById } from "@/lib/console/fixtures"
import { CaseDetail } from "@/components/console/CaseDetail"

export const metadata: Metadata = { title: "Case | TxID Console" }
export const dynamic = "force-dynamic"

export default function CasePage({ params }: { params: { caseId: string } }) {
  const hit = caseById(params.caseId)
  if (!hit) notFound()
  return <CaseDetail base="/console" customer={hit.customer} interaction={hit.interaction} />
}
