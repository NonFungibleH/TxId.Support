import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"
import { originAllowed } from "@/lib/origin-guard"
import type { ProjectConfig } from "@/lib/types/config"

function isPublicSurface(key: string, config: { publicDemo?: boolean } | null | undefined): boolean {
  const a = process.env.DEMO_WIDGET_KEY
  const b = process.env.NEXT_PUBLIC_DEMO_WIDGET_KEY
  return (!!a && key === a) || (!!b && key === b) || config?.publicDemo === true
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { key?: string; sessionId?: string; feedback?: number }
  const { key, sessionId, feedback } = body

  if (!key || !sessionId || (feedback !== 1 && feedback !== -1)) {
    return Response.json({ error: "Bad request" }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Resolve project from publishable key
  const { data: project } = await supabase
    .from("projects")
    .select("id, config")
    .eq("publishable_key", key)
    .maybeSingle()

  if (!project) return Response.json({ error: "Invalid key" }, { status: 403 })

  // Thumbs are low-stakes, but they write to a customer's record and feed the
  // gaps view: an unguarded key let anyone poison the quality signal a team
  // uses to decide what to fix.
  const config = (project as unknown as { config?: ProjectConfig }).config
  if (!originAllowed(req, config?.allowedDomains, { publicSurface: isPublicSurface(key, config) })) {
    return Response.json({ error: "This key is not authorised for this domain." }, { status: 403 })
  }

  // Find conversation by session_id scoped to this project
  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("project_id", project.id)
    .eq("session_id", sessionId)
    .maybeSingle()

  if (!conv) return Response.json({ error: "Conversation not found" }, { status: 404 })

  // Update the last assistant message with the feedback value
  const { data: lastMsg } = await supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", conv.id)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastMsg) return Response.json({ error: "No message to rate" }, { status: 404 })

  await supabase
    .from("messages")
    .update({ feedback })
    .eq("id", lastMsg.id)

  return Response.json({ ok: true })
}
