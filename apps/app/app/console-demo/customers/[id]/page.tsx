import { notFound } from "next/navigation"
import { CustomerProfile } from "@/components/console/CustomerProfile"
import { demoCustomer } from "@/lib/console/fixtures"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoCustomer({ params }: { params: { id: string } }) {
  if (process.env.VERCEL_ENV === "production") notFound()
  const customer = demoCustomer(params.id)
  if (!customer) notFound()
  return <CustomerProfile base="/console-demo" customer={customer} />
}
