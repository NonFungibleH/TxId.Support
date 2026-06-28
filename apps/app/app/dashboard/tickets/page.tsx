import { getProject } from "@/lib/actions/project"
import { getTickets, getWebhookLogs } from "@/lib/actions/tickets"
import { TicketList } from "@/components/dashboard/TicketList"
import { WebhookLogList } from "@/components/dashboard/WebhookLogList"
import type { Database } from "@/lib/supabase/types"
import type { ProjectConfig } from "@/lib/types/config"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function TicketsPage() {
  const { project } = await getProject()
  if (!project) return null

  const typedProject = project as unknown as ProjectRow & { name: string }
  const config = typedProject.config as unknown as ProjectConfig

  const [tickets, webhookLogs] = await Promise.all([
    getTickets(typedProject.id),
    config.webhookUrl ? getWebhookLogs(typedProject.id) : Promise.resolve([]),
  ])

  return (
    <div className="space-y-8">
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

      {config.webhookUrl && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold">Webhook delivery log</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Last 50 outbound deliveries to{" "}
              <code className="font-mono text-[11px] text-muted-foreground">{config.webhookUrl}</code>
            </p>
          </div>
          <WebhookLogList logs={webhookLogs} />
        </div>
      )}
    </div>
  )
}
