"use server"

import { revalidatePath } from "next/cache"
import { createServiceClient } from "@/lib/supabase/server"
import { auth } from "@clerk/nextjs/server"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database, Json } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

type ResolvedProject = Pick<ProjectRow, "id" | "config" | "org_id"> & {
  name: string
  publishable_key: string
  secret_key: string
}

async function resolveProjectWithOwnership(projectId: string): Promise<ResolvedProject> {
  const { orgId, userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")
  const orgKey = orgId ?? userId

  const supabase = createServiceClient()

  const orgResult = await supabase
    .from("organisations")
    .select("id")
    .eq("clerk_org_id", orgKey)
    .single()

  const orgData = orgResult.data as unknown as { id: string } | null
  if (!orgData) throw new Error("Org not found")

  const projectResult = await supabase
    .from("projects")
    .select("id, name, config, org_id, publishable_key, secret_key")
    .eq("id", projectId)
    .eq("org_id", orgData.id)
    .single()

  const project = projectResult.data as unknown as ResolvedProject | null
  if (projectResult.error || !project) throw new Error("Project not found or forbidden")

  return project
}

interface TelegramBotInfo {
  username: string
  first_name: string
}

async function callTelegramApi(
  token: string,
  method: string,
  body?: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await res.json() as { ok: boolean; result?: unknown; description?: string }
  if (!data.ok) throw new Error(data.description ?? `Telegram API error: ${method}`)
  return data.result
}

export async function saveTelegramToken(projectId: string, token: string) {
  if (!token.trim()) throw new Error("Token is required")

  // Validate token by calling getMe
  let botInfo: TelegramBotInfo
  try {
    botInfo = (await callTelegramApi(token.trim(), "getMe")) as TelegramBotInfo
  } catch {
    throw new Error("Invalid bot token. Create a bot with @BotFather and paste the token here.")
  }

  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ""
  const webhookUrl = `${appUrl}/api/telegram/${project.publishable_key}`

  // Wire webhook — this must succeed
  await callTelegramApi(token.trim(), "setWebhook", {
    url: webhookUrl,
    secret_token: project.secret_key,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  })

  // Auto-configure bot identity + commands — best-effort, don't block on failure
  const botDisplayName = `${project.name} Support`.slice(0, 64)
  const description = `I'm the AI support assistant for ${project.name}. Ask me anything — I can look up your transactions, explain contract errors, and help you get unstuck.`
  const shortDescription = `AI support for ${project.name}. Ask anything.`.slice(0, 120)

  await Promise.allSettled([
    callTelegramApi(token.trim(), "setMyName", { name: botDisplayName }),
    callTelegramApi(token.trim(), "setMyDescription", { description }),
    callTelegramApi(token.trim(), "setMyShortDescription", { short_description: shortDescription }),
    callTelegramApi(token.trim(), "setMyCommands", {
      commands: [
        { command: "ask",   description: "Ask a question about this protocol" },
        { command: "help",  description: "Get help or contact support" },
        { command: "start", description: "Start a conversation" },
      ],
    }),
  ])

  const updated: ProjectConfig = {
    ...config,
    telegramBotToken: token.trim(),
    telegramBotUsername: botInfo.username,
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/telegram")
  return { username: botInfo.username, botDisplayName }
}

export async function removeTelegramToken(projectId: string) {
  const project = await resolveProjectWithOwnership(projectId)
  const config = project.config as unknown as ProjectConfig

  if (config.telegramBotToken) {
    try {
      await callTelegramApi(config.telegramBotToken, "deleteWebhook")
    } catch {
      // Best effort — proceed even if Telegram call fails
    }
  }

  const updated: ProjectConfig = {
    ...config,
    telegramBotToken: null,
    telegramBotUsername: null,
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("projects")
    .update({ config: updated as unknown as Json })
    .eq("id", projectId)

  if (error) throw new Error(error.message)
  revalidatePath("/dashboard/telegram")
}
