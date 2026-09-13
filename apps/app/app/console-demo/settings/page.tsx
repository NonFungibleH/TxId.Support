import { notFound } from "next/navigation"
import { SettingsIndex } from "@/components/console/SettingsIndex"

export const dynamic = "force-dynamic"

/** Same view, no auth. See app/console-demo/page.tsx for why this exists. */
export default function DemoSettings() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return <SettingsIndex base="/console-demo" />
}
