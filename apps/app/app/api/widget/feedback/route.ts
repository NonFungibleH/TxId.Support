import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

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
    .select("id")
    .eq("publishable_key", key)
    .maybeSingle()

  if (!project) return Response.json({ error: "Invalid key" }, { status: 403 })

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
