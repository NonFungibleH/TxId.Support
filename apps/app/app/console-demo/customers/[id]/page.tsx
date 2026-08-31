import { notFound } from "next/navigation"
import { customerById } from "@/lib/console/fixtures"
import { CustomerProfile } from "@/components/console/CustomerProfile"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoCustomer({ params }: { params: { id: string } }) {
  if (process.env.VERCEL_ENV === "production") notFound()
  const customer = customerById(params.id)
  if (!customer) notFound()
  return <CustomerProfile base="/console-demo" customer={customer} />
}
