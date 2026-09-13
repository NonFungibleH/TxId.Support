import { notFound } from "next/navigation"
import { InboxList } from "@/components/console/InboxList"
import { allCases } from "@/lib/console/fixtures"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoInbox({ searchParams }: { searchParams?: { cause?: string; status?: string } }) {
  if (process.env.VERCEL_ENV === "production") notFound()
  const cause = searchParams?.cause
  const status = searchParams?.status
  let cases = allCases()
  if (cause) cases = cases.filter(c => c.code === cause)
  if (status === "open") cases = cases.filter(c => c.outcome === "failed")
  if (status === "waiting") cases = cases.filter(c => c.outcome === "pending")
  if (status === "unknown") cases = cases.filter(c => c.outcome === "indeterminate")
  return <InboxList base="/console-demo" cases={cases} {...(cause ? { cause } : {})} {...(status ? { status } : {})} />
}
