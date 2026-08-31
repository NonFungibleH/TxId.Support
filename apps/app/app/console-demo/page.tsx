import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ConsoleOverview } from "@/components/console/ConsoleOverview"

export const metadata: Metadata = { title: "Console demo | TxID", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/**
 * Fixtures-only Console, so the design can be reviewed on a branch preview
 * where Clerk cannot initialise with production keys on a *.vercel.app host.
 *
 * It sits BESIDE /console rather than under it: a child route inherits its
 * parent layout, and the authenticated console layout throws before its own
 * layout is reached.
 *
 * Safe as the Console grows real data because it 404s in production, checked
 * here rather than hidden by navigation, and renders components that read
 * fixtures and have no data access of their own.
 */
export default function ConsoleDemoPage() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <ConsoleOverview base="/console-demo" />
}
