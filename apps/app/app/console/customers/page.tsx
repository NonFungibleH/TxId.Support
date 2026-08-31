import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { resolveSearchTarget } from "@/lib/console/fixtures"
import { CustomerDirectory } from "@/components/console/CustomerDirectory"

export const metadata: Metadata = { title: "Customers | TxID Console" }
export const dynamic = "force-dynamic"

export default function CustomersPage({ searchParams }: { searchParams?: { q?: string } }) {
  const q = searchParams?.q
  if (q) {
    const target = resolveSearchTarget(q)
    if (target) redirect(`/console${target}`)
  }
  return <CustomerDirectory base="/console" {...(q ? { q } : {})} />
}
