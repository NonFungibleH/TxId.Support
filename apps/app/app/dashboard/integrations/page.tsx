import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { IntegrationsForm, type IntegrationsStatus } from "@/components/settings/IntegrationsForm"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function IntegrationsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig
  const i = config.integrations ?? {}

  // Secrets are never sent to the client — only {configured} booleans plus the
  // non-secret display fields (repo, domain, team id, chat id, …).
  const status: IntegrationsStatus = {
    slack:    { enabled: !!i.slack?.enabled,    configured: !!i.slack?.webhookUrl },
    discord:  { enabled: !!i.discord?.enabled,  configured: !!i.discord?.webhookUrl },
    telegram: { enabled: !!i.telegram?.enabled, chatId: i.telegram?.chatId ?? "", botConnected: !!config.telegramBotToken },
    linear:   { enabled: !!i.linear?.enabled,   teamId: i.linear?.teamId ?? "", configured: !!i.linear?.apiKey },
    github:   { enabled: !!i.github?.enabled,   repo: i.github?.repo ?? "", configured: !!i.github?.token },
    jira:     { enabled: !!i.jira?.enabled,     domain: i.jira?.domain ?? "", email: i.jira?.email ?? "", projectKey: i.jira?.projectKey ?? "", configured: !!i.jira?.apiToken },
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground mt-1">
          When a support ticket is raised, send it where your team works. Notify a channel (Slack, Discord, Telegram) and open a tracked issue (Linear, GitHub, Jira) automatically.
        </p>
      </div>
      <IntegrationsForm initial={status} />
    </div>
  )
}
