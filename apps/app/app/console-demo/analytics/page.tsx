import { notFound } from "next/navigation"
import { AnalyticsView } from "@/components/console/AnalyticsView"
import { CAUSES, demoBasisCounts } from "@/lib/console/fixtures"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoAnalytics() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <AnalyticsView base="/console-demo" causes={CAUSES} basis={demoBasisCounts()} />
}
