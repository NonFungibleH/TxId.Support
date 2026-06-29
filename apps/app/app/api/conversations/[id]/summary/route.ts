import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import Anthropic from "@anthropic-ai/sdk"
import { createServiceClient } from "@/lib/supabase/server"
import { getProject } from "@/lib/actions/project"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { userId } = await auth()
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { project } = await getProject()
  if (!project) return Response.json({ error: "No project" }, { status: 403 })
  const typedProject = project as unknown as ProjectRow

  const supabase = createServiceClient()

  const { data: conv } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", params.id)
    .eq("project_id", typedProject.id)
    .maybeSingle()

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 })

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true })
    .limit(20)

  if (!messages || messages.length === 0) {
    return Response.json({ summary: "No messages recorded." })
  }

  const transcript = messages
    .map((m) => `${m.role === "user" ? "User" : "Support bot"}: ${m.content}`)
    .join("\n")

  const msg = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 80,
    messages: [
      {
        role: "user",
        content: `Summarise this crypto support conversation in one sentence (max 20 words). Focus on what the user needed and whether it was resolved.\n\n${transcript}`,
      },
    ],
  })

  const summary = msg.content[0]?.type === "text" ? msg.content[0].text.trim() : ""
  return Response.json({ summary })
}
