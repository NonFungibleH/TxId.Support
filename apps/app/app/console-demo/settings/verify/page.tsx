import { notFound } from "next/navigation"
import Page from "@/app/console/settings/verify/page"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoVerify() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <Page />
}
