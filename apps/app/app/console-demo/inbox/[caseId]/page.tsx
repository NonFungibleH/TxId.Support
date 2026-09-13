import { notFound } from "next/navigation"
import { CaseDetail } from "@/components/console/CaseDetail"
import { demoCaseView } from "@/lib/console/fixtures"

export const dynamic = "force-dynamic"

/** Same view, no auth, and no access log: fixture browsing never pollutes it. */
export default function DemoCase({ params }: { params: { caseId: string } }) {
  if (process.env.VERCEL_ENV === "production") notFound()
  const view = demoCaseView(params.caseId)
  if (!view) notFound()
  return <CaseDetail base="/console-demo" view={view} />
}
