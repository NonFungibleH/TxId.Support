import type { Metadata } from "next"
import { SettingsIndex } from "@/components/console/SettingsIndex"

export const metadata: Metadata = { title: "Settings | TxID Console" }
export const dynamic = "force-dynamic"

export default function SettingsPage() {
  return <SettingsIndex base="/console" />
}
