import { auth } from "@clerk/nextjs/server"
import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { recordCaseAccess } from "@/lib/case-access"

// Evidence columns turn the export from a transcript into a record: a
// reviewer can replay the chain state and check the answer has not changed.
const HEADER = [
  "session_id", "wallet_address", "chain_id", "conversation_started", "role", "content",
  "ledger_version", "block_number", "block_hash", "state_read_at", "country", "model", "answer_sha256",
  "tools_used", "failed_lookups", "grounding", "unverified_numbers", "sources_count",
].join(",")

interface EvidenceShape {
  chain?: { ledgerVersion?: string; blockNumber?: string; blockHash?: string; readAt?: string }
  request?: { country?: string }
  model?: { name?: string }
  answer?: { sha256?: string }
  investigation?: { toolsUsed?: string[]; failedLookups?: string[] }
  grounding?: string
  unverifiedNumbers?: string[]
  sources?: unknown[]
}

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
    const csv = `${HEADER}\n`
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="conversations.csv"`,
      },
    })
  }

  const convIds = conversations.map((c) => c.id)
  // Ask for evidence, and fall back without it so an export still works on a
  // deployment that has not run the migration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: messages } = await ((supabase as any)
    .from("messages")
    .select("conversation_id, role, content, created_at, evidence")
    .in("conversation_id", convIds)
    .order("created_at", { ascending: true })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .then((res: any) =>
      res.error
        ? supabase
            .from("messages")
            .select("conversation_id, role, content, created_at")
            .in("conversation_id", convIds)
            .order("created_at", { ascending: true })
        : res,
    ))

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

  const rows: string[] = [HEADER]
  for (const conv of conversations) {
    const msgs = msgByConv.get(conv.id) ?? []
    if (msgs.length === 0) {
      rows.push([
        escapeCell(conv.session_id),
        escapeCell(conv.wallet_address),
        escapeCell(conv.chain_id),
        escapeCell(conv.created_at),
        "", "", "", "", "", "", "",
      ].join(","))
    } else {
      for (const msg of msgs) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = ((msg as any).evidence ?? null) as EvidenceShape
        rows.push([
          escapeCell(conv.session_id),
          escapeCell(conv.wallet_address),
          escapeCell(conv.chain_id),
          escapeCell(conv.created_at),
          escapeCell(msg.role),
          escapeCell(msg.content),
          escapeCell(ev?.chain?.ledgerVersion),
          escapeCell(ev?.chain?.blockNumber),
          escapeCell(ev?.chain?.blockHash),
          escapeCell(ev?.chain?.readAt),
          escapeCell(ev?.request?.country),
          escapeCell(ev?.model?.name),
          escapeCell(ev?.answer?.sha256),
          escapeCell((ev?.investigation?.toolsUsed ?? []).join("; ")),
          escapeCell((ev?.investigation?.failedLookups ?? []).join("; ")),
          escapeCell(ev?.grounding),
          escapeCell((ev?.unverifiedNumbers ?? []).join("; ")),
          escapeCell(String((ev?.sources ?? []).length)),
        ].join(","))
      }
    }
  }

  // An export is a disclosure of client data, so it is logged like one.
  await recordCaseAccess({
    projectId,
    actor: userId,
    action: "export",
    detail: { conversations: conversations.length, rows: rows.length - 1 },
  })

  const csv = rows.join("\n")
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="conversations.csv"`,
    },
  })
}
