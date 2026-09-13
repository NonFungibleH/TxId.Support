import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { liveSetup, listCustomers } from "@/lib/console/data"
import { IdentitySetup } from "@/components/console/IdentitySetup"
import type { ProjectConfig } from "@/lib/types/config"

export const metadata: Metadata = { title: "Customer identity | TxID Console" }
export const dynamic = "force-dynamic"

export default async function IdentityPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")
  const p = project as unknown as { id: string; config: ProjectConfig | null }
  const [setup, customers] = await Promise.all([liveSetup(p), listCustomers(p.id)])
  const mapped = customers.kind === "ok" ? customers.value.filter(c => c.email !== null || c.since !== null).length : 0
  return <IdentitySetup state={{ mapped, newestSource: setup.identitySource === "none" ? null : setup.identitySource }} />
}
