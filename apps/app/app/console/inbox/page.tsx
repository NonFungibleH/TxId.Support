import type { Metadata } from "next"
import { InboxList } from "@/components/console/InboxList"

export const metadata: Metadata = { title: "Inbox | TxID Console" }
export const dynamic = "force-dynamic"

export default function InboxPage({ searchParams }: { searchParams?: { cause?: string; status?: string } }) {
  return <InboxList base="/console" {...(searchParams?.cause ? { cause: searchParams.cause } : {})} {...(searchParams?.status ? { status: searchParams.status } : {})} />
}
