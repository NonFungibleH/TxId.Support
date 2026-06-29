import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { summarizeConversation } from "@txid/ai"
import { createServiceClient } from "@/lib/supabase/server"
import { getProject } from "@/lib/actions/project"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

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

  const summary = await summarizeConversation(messages ?? [])
  return Response.json({ summary })
}
