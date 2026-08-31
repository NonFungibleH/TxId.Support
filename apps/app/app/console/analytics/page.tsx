import type { Metadata } from "next"
import { AnalyticsView } from "@/components/console/AnalyticsView"

export const metadata: Metadata = { title: "Analytics | TxID Console" }
export const dynamic = "force-dynamic"

export default function AnalyticsPage() {
  return <AnalyticsView base="/console" />
}
