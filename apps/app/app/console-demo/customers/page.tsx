import { notFound, redirect } from "next/navigation"
import { resolveSearchTarget } from "@/lib/console/fixtures"
import { CustomerDirectory } from "@/components/console/CustomerDirectory"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoCustomers({ searchParams }: { searchParams?: { q?: string } }) {
  if (process.env.VERCEL_ENV === "production") notFound()
  const q = searchParams?.q
  if (q) {
    const target = resolveSearchTarget(q)
    if (target) redirect(`/console-demo${target}`)
  }
  return <CustomerDirectory base="/console-demo" {...(q ? { q } : {})} />
}
