"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { getProject } from "@/lib/actions/project"

export interface Ticket {
  id: string
  project_id: string
  ref: string
  user_name: string | null
  user_email: string | null
  summary: string
  reason: string | null
  conversation: unknown
  status: "open" | "in_progress" | "resolved"
  notes: string | null
  created_at: string
  updated_at: string
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
  return (data ?? []) as Ticket[]
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
  // Scoped to the caller's project — prevents cross-account ticket modification
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
