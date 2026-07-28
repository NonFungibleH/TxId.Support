import { redirect } from "next/navigation"

// Integrations moved into the Tickets page's "Escalation routing" section.
// Keep this route as a redirect so old links/bookmarks still land somewhere useful.
export default function IntegrationsPage() {
  redirect("/dashboard/tickets")
}
