import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { customerById } from "@/lib/console/fixtures"
import { CustomerProfile } from "@/components/console/CustomerProfile"

export const metadata: Metadata = { title: "Customer | TxID Console" }
export const dynamic = "force-dynamic"

export default function CustomerPage({ params }: { params: { id: string } }) {
  const customer = customerById(params.id)
  if (!customer) notFound()
  return <CustomerProfile base="/console" customer={customer} />
}
