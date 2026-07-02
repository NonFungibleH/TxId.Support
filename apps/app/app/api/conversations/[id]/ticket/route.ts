import { NextRequest } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { getProject } from "@/lib/actions/project"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export async function POST(
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
    .select("id, wallet_address, chain_id")
    .eq("id", params.id)
    .eq("project_id", typedProject.id)
    .maybeSingle()

  if (!conv) return Response.json({ error: "Not found" }, { status: 404 })

  const { data: messages } = await supabase
    .from("messages")
    .select("role, content")
    .eq("conversation_id", params.id)
    .order("created_at", { ascending: true })

  const firstUserMsg = messages?.find(m => m.role === "user")?.content ?? "Support request"
  const summary = firstUserMsg.length > 200 ? firstUserMsg.slice(0, 197) + "…" : firstUserMsg

  const safeConversation = (messages ?? []).map(m => ({ role: m.role, content: m.content }))

  const ref = "TKT-" + Math.random().toString(36).slice(2, 8).toUpperCase()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: ticket, error } = await (supabase as any)
    .from("tickets")
    .insert({
      project_id: typedProject.id,
      conversation_id: params.id,
      ref,
      summary,
      reason: conv.wallet_address ? `Wallet: ${conv.wallet_address}` : null,
      conversation: safeConversation.length ? safeConversation : null,
      status: "open",
    })
    .select("ref")
    .single()

  if (error) return Response.json({ error: "Failed to create ticket" }, { status: 500 })

  return Response.json({ ref: ticket.ref })
}
