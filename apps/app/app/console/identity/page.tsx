import type { Metadata } from "next"
import { IdentitySetup } from "@/components/console/IdentitySetup"

export const metadata: Metadata = { title: "Customer identity | TxID Console" }
export const dynamic = "force-dynamic"

export default function IdentityPage() {
  return <IdentitySetup />
}
