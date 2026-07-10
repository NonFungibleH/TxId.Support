import { redirect } from "next/navigation"

// Token configuration now lives in its own dedicated section on the Smart
// Contracts page (it was never in the sidebar nav). This redirects so any old
// links or bookmarks still resolve.
export default function TokenPage() {
  redirect("/dashboard/contracts")
}
