"use server"

import { auth } from "@clerk/nextjs/server"
import { createServiceClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

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

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("tickets")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", ticketId)

  revalidatePath("/dashboard/tickets")
}

export async function updateTicketNotes(ticketId: string, notes: string) {
  const { userId } = await auth()
  if (!userId) throw new Error("Unauthenticated")

  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("tickets")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", ticketId)

  revalidatePath("/dashboard/tickets")
}
