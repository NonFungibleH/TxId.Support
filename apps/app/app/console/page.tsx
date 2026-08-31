import type { Metadata } from "next"
import { ConsoleWorkspace } from "@/components/console/ConsoleWorkspace"

export const metadata: Metadata = { title: "Console | TxID" }
export const dynamic = "force-dynamic"

export default function ConsolePage() {
  return <ConsoleWorkspace />
}
