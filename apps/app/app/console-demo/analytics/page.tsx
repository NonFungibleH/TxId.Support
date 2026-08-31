import { notFound } from "next/navigation"
import Page from "@/app/console/analytics/page"

export const dynamic = "force-dynamic"

/** Same page, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoPage() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <Page />
}
