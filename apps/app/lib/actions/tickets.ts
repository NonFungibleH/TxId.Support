"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getProject } from "@/lib/actions/project"

import { ticketSignals, type TicketSignals } from "@/lib/ticket-signals"

export interface Ticket {
  id: string
  project_id: string
  ref: string
  user_name: string | null
  user_email: string | null
  summary: string
  reason: string | null
  conversation: unknown
  status: "open" | "in_progress" | "waiting" | "resolved" | "closed"
  notes: string | null
  external_refs?: Record<string, string> | null
  assignee_id?: string | null
  assignee_email?: string | null
  priority?: "low" | "normal" | "high" | "urgent" | null
  first_response_at?: string | null
  resolved_at?: string | null
  conversation_id?: string | null
  created_at: string
  updated_at: string
  /** Computed from the conversation's own evidence. Never model-reported. */
  signals?: TicketSignals
}

export async function getTickets(projectId: string): Promise<Ticket[]> {
  // Verify the caller owns this project before returning any data
  const { project } = await getProject()
  if (!project || (project as unknown as { id: string }).id !== projectId) return []

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("tickets")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })

  const tickets = (data ?? []) as Ticket[]
  const convIds = tickets.map(t => t.conversation_id).filter((v): v is string => !!v)
  if (convIds.length === 0) return tickets

  // One query for every ticket's messages rather than one per ticket. Evidence
  // may predate the column, so a failure degrades to no signals rather than no
  // tickets.
  const [{ data: msgs }, { data: convs }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from("messages")
      .select("conversation_id, role, feedback, evidence, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: true }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("conversations").select("id, category").in("id", convIds),
  ]).catch(() => [{ data: null }, { data: null }])

  if (!msgs) return tickets

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byConv = new Map<string, any[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of msgs as any[]) {
    const list = byConv.get(m.conversation_id) ?? []
    list.push(m)
    byConv.set(m.conversation_id, list)
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const catByConv = new Map(((convs ?? []) as any[]).map(c => [c.id as string, c.category as string | null]))

  return tickets.map(t => {
    if (!t.conversation_id) return t
    const messages = byConv.get(t.conversation_id)
    if (!messages) return t
    return { ...t, signals: ticketSignals(messages, catByConv.get(t.conversation_id) ?? null) }
  })
}

export async function updateTicketStatus(
  ticketId: string,
  status: "open" | "in_progress" | "resolved",
) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")

  const { project } = await getProject()
  if (!project) throw new Error("No project")
  const projectId = (project as unknown as { id: string }).id

  const supabase = createServiceClient()
  // Scoped to the caller's project - prevents cross-account ticket modification
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("project_id", projectId)

  revalidatePath("/dashboard/tickets")
}

export async function updateTicketNotes(ticketId: string, notes: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")

  const { project } = await getProject()
  if (!project) throw new Error("No project")
  const projectId = (project as unknown as { id: string }).id

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("tickets")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("project_id", projectId)

  revalidatePath("/dashboard/tickets")
}

export interface WebhookLog {
  id: string
  project_id: string
  ticket_ref: string
  webhook_url: string
  status_code: number | null
  success: boolean
  error_message: string | null
  duration_ms: number | null
  fired_at: string
}

export async function getWebhookLogs(projectId: string): Promise<WebhookLog[]> {
  const { project } = await getProject()
  if (!project || (project as unknown as { id: string }).id !== projectId) return []

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any).from("webhook_logs")
    .select("*")
    .eq("project_id", projectId)
    .order("fired_at", { ascending: false })
    .limit(50)
  return (data ?? []) as WebhookLog[]
}
