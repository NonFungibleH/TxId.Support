import { notFound } from "next/navigation"
import { CrmSetup } from "@/components/console/CrmSetup"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoCrm() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <CrmSetup />
}
