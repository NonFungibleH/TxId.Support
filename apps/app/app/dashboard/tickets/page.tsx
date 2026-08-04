import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { getTickets, getWebhookLogs } from "@/lib/actions/tickets"
import { TicketList } from "@/components/dashboard/TicketList"
import { EscalationRouting } from "@/components/dashboard/EscalationRouting"
import { WebhookLogList } from "@/components/dashboard/WebhookLogList"
import { UndeliveredEscalations } from "@/components/dashboard/UndeliveredEscalations"
import { listFailedDeliveries } from "@/lib/actions/integrations"
import type { IntegrationsStatus } from "@/components/settings/IntegrationsForm"
import type { Database } from "@/lib/supabase/types"
import type { ProjectConfig } from "@/lib/types/config"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function TicketsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow & { name: string }
  const config = typedProject.config as unknown as ProjectConfig

  const [tickets, webhookLogs, failedDeliveries] = await Promise.all([
    getTickets(typedProject.id),
    config.webhookUrl ? getWebhookLogs(typedProject.id) : Promise.resolve([]),
    listFailedDeliveries(),
  ])

  // Secrets are never sent to the client - only {configured} booleans plus the
  // non-secret display fields (repo, domain, team id, chat id, …).
  const i = config.integrations ?? {}
  const integrations: IntegrationsStatus = {
    slack:    { enabled: !!i.slack?.enabled,    configured: !!i.slack?.webhookUrl },
    discord:  { enabled: !!i.discord?.enabled,  configured: !!i.discord?.webhookUrl },
    telegram: { enabled: !!i.telegram?.enabled, chatId: i.telegram?.chatId ?? "", botConnected: !!config.telegramBotToken },
    linear:   { enabled: !!i.linear?.enabled,   teamId: i.linear?.teamId ?? "", configured: !!i.linear?.apiKey },
    github:   { enabled: !!i.github?.enabled,   repo: i.github?.repo ?? "", configured: !!i.github?.token },
    jira:     { enabled: !!i.jira?.enabled,     domain: i.jira?.domain ?? "", email: i.jira?.email ?? "", projectKey: i.jira?.projectKey ?? "", configured: !!i.jira?.apiToken },
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Support Tickets</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Escalations raised by users when the bot couldn&apos;t resolve their issue.
        </p>
      </div>

      <EscalationRouting
        projectId={typedProject.id}
        notificationEmail={config.notificationEmail ?? ""}
        webhookUrl={config.webhookUrl ?? ""}
        integrations={integrations}
      />

      <UndeliveredEscalations deliveries={failedDeliveries} />

      <TicketList tickets={tickets} />

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
