import { auth } from "@clerk/nextjs/server"
import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"

export async function GET() {
  const { userId } = await auth()
  if (!userId) return new Response("Unauthorized", { status: 401 })

  const { project } = await getProject()
  if (!project) return new Response("Not found", { status: 404 })

  const supabase = createServiceClient()
  const projectId = (project as { id: string }).id

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, session_id, wallet_address, chain_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5000)

  if (!conversations || conversations.length === 0) {
    const csv = "session_id,wallet_address,chain_id,created_at,role,content\n"
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="conversations.csv"`,
      },
    })
  }

  const convIds = conversations.map((c) => c.id)
  const { data: messages } = await supabase
    .from("messages")
    .select("conversation_id, role, content, created_at")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: true })

  const msgByConv = new Map<string, typeof messages>()
  for (const msg of messages ?? []) {
    const existing = msgByConv.get(msg.conversation_id) ?? []
    existing.push(msg)
    msgByConv.set(msg.conversation_id, existing)
  }

  function escapeCell(value: string | null | undefined): string {
    if (value == null) return ""
    const str = String(value)
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`
    }
    return str
  }

  const rows: string[] = ["session_id,wallet_address,chain_id,conversation_started,role,content"]
  for (const conv of conversations) {
    const msgs = msgByConv.get(conv.id) ?? []
    if (msgs.length === 0) {
      rows.push([
        escapeCell(conv.session_id),
        escapeCell(conv.wallet_address),
        escapeCell(conv.chain_id),
        escapeCell(conv.created_at),
        "",
        "",
      ].join(","))
    } else {
      for (const msg of msgs) {
        rows.push([
          escapeCell(conv.session_id),
          escapeCell(conv.wallet_address),
          escapeCell(conv.chain_id),
          escapeCell(conv.created_at),
          escapeCell(msg.role),
          escapeCell(msg.content),
        ].join(","))
      }
    }
  }

  const csv = rows.join("\n")
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="conversations.csv"`,
    },
  })
}
