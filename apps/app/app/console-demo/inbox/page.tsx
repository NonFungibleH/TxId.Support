import { notFound } from "next/navigation"
import { InboxList } from "@/components/console/InboxList"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoInbox({ searchParams }: { searchParams?: { cause?: string; status?: string } }) {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <InboxList base="/console-demo" {...(searchParams?.cause ? { cause: searchParams.cause } : {})} {...(searchParams?.status ? { status: searchParams.status } : {})} />
}
