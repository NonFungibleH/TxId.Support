import type { Metadata } from "next"
import { ConsoleOverview } from "@/components/console/ConsoleOverview"

export const metadata: Metadata = { title: "Console | TxID" }
export const dynamic = "force-dynamic"

export default function ConsoleOverviewPage() {
  return <ConsoleOverview base="/console" />
}
