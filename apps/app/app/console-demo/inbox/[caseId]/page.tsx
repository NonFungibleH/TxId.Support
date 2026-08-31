import { notFound } from "next/navigation"
import { caseById } from "@/lib/console/fixtures"
import { CaseDetail } from "@/components/console/CaseDetail"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoCase({ params }: { params: { caseId: string } }) {
  if (process.env.VERCEL_ENV === "production") notFound()
  const hit = caseById(params.caseId)
  if (!hit) notFound()
  return <CaseDetail base="/console-demo" customer={hit.customer} interaction={hit.interaction} />
}
