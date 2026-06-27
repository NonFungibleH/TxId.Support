import { getProject } from "@/lib/actions/project"
import { getTickets } from "@/lib/actions/tickets"
import { TicketList } from "@/components/dashboard/TicketList"
import type { Database } from "@/lib/supabase/types"
import type { ProjectConfig } from "@/lib/types/config"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function TicketsPage() {
  const { project } = await getProject()
  if (!project) return null

  const typedProject = project as unknown as ProjectRow & { name: string }
  const config = typedProject.config as unknown as ProjectConfig
  const tickets = await getTickets(typedProject.id)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escalations raised by users when the bot couldn&apos;t resolve their issue.
        </p>
      </div>

      <TicketList
        projectId={typedProject.id}
        tickets={tickets}
        notificationEmail={config.notificationEmail ?? ""}
        webhookUrl={config.webhookUrl ?? ""}
      />
    </div>
  )
}
