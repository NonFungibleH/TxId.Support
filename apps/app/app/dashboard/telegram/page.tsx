import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { TelegramPageClient } from "@/components/settings/TelegramPageClient"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function TelegramPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Telegram</h1>
        <p className="text-muted-foreground mt-1">
          Add your AI to a Telegram group so users can ask questions and get on-chain support directly in chat.
        </p>
      </div>
      <TelegramPageClient
        projectId={typedProject.id}
        botUsername={config.telegramBotUsername ?? null}
        connected={!!config.telegramBotToken}
      />
    </div>
  )
}
