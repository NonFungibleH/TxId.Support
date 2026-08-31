import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { ConsoleWorkspace } from "@/components/console/ConsoleWorkspace"

export const metadata: Metadata = { title: "Console demo | TxID", robots: { index: false, follow: false } }
export const dynamic = "force-dynamic"

/**
 * Fixtures-only view of the Console, so it can be reviewed on a branch preview.
 *
 * It exists because the Preview environment runs PRODUCTION Clerk keys, which
 * are domain-locked to txid.support, so Clerk refuses to initialise on a
 * *.vercel.app host and every authenticated page renders blank. The real fix is
 * development Clerk keys scoped to Preview; until that lands, no apps/app branch
 * preview is reviewable at all.
 *
 * Two properties keep this safe as the Console grows real data:
 *   1. It 404s in production, checked below, not merely hidden by navigation.
 *   2. It renders ConsoleWorkspace, which reads FIXTURES. It has no data access
 *      of its own, so wiring the real Console to the database cannot leak
 *      through here without someone deliberately changing this file.
 */
export default function ConsoleDemoPage() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <ConsoleWorkspace />
}
