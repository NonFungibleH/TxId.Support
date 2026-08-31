import type { Metadata } from "next"
import { ConsoleWorkspace } from "@/components/console/ConsoleWorkspace"

export const metadata: Metadata = { title: "Find a customer | TxID Console" }
export const dynamic = "force-dynamic"

export default function CasesPage() {
  return <ConsoleWorkspace />
}
