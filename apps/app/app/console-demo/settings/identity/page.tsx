import { notFound } from "next/navigation"
import { IdentitySetup } from "@/components/console/IdentitySetup"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoIdentity() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <IdentitySetup />
}
