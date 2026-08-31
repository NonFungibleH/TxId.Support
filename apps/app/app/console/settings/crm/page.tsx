import type { Metadata } from "next"
import { CrmSetup } from "@/components/console/CrmSetup"

export const metadata: Metadata = { title: "CRM | TxID Console" }
export const dynamic = "force-dynamic"

export default function CrmPage() {
  return <CrmSetup />
}
