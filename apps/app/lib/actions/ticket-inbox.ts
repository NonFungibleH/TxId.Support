"use server"

import { waitUntil } from "@vercel/functions"
import { revalidatePath } from "next/cache"
import { requireCapability } from "@/lib/roles-server"
import { createServiceClient } from "@/lib/supabase/server"
import { recordAudit } from "@/lib/audit"

/**
 * Working a ticket: who owns it, how urgent it is, and what was actually done.
 *
 * Every one of these writes a `ticket_events` row as well as changing the
 * ticket, because the status field says where a ticket ended up and the events
 * say how it got there. The second is the part an institutional buyer means
 * when they ask for an audit trail.
 */

export type TicketStatus = "open" | "in_progress" | "waiting" | "resolved" | "closed"
export type TicketPriority = "low" | "normal" | "high" | "urgent"
export type EventChannel = "email" | "telegram" | "discord" | "crm" | "other"

export interface TicketEvent {
  id: string
  kind: string
  channel: string | null
  body: string | null
  url: string | null
  actorEmail: string | null
  createdAt: string
}

async function actorEmailFor(): Promise<string | null> {
  try {
    const { currentUser } = await import("@clerk/nextjs/server")
    const u = await currentUser()
    return u?.emailAddresses?.[0]?.emailAddress ?? null
  } catch { return null }
}

/** Scope every write to the caller's own project, so an id from elsewhere finds nothing. */
async function ownedTicket(ticketId: string) {
  const { getProject } = await import("@/lib/actions/project")
  const { project } = await getProject()
  if (!project) throw new Error("No project")
  const projectId = (project as { id: string }).id
  const supabase = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("tickets")
    .select("id, ref, status, first_response_at")
    .eq("id", ticketId)
    .eq("project_id", projectId)
    .maybeSingle()
  if (!data) throw new Error("Ticket not found")
  return { supabase, projectId, ticket: data }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function addEvent(supabase: any, ticketId: string, projectId: string, row: Record<string, unknown>) {
  const actor = await requireCapability("tickets")
  await supabase.from("ticket_events").insert({
    ticket_id: ticketId,
    project_id: projectId,
    actor_id: actor.userId,
    actor_email: await actorEmailFor(),
    ...row,
  })
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  await requireCapability("tickets")
  const { supabase, projectId, ticket } = await ownedTicket(ticketId)
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("tickets").update({
    status,
    updated_at: now,
    // Stamped once, on the first move off "open", so "how long until someone
    // picked this up" stays answerable after later status changes.
    ...(ticket.first_response_at || status === "open" ? {} : { first_response_at: now }),
    ...(status === "resolved" || status === "closed" ? { resolved_at: now } : { resolved_at: null }),
  }).eq("id", ticketId)
  await addEvent(supabase, ticketId, projectId, { kind: "status_changed", body: status })
  waitUntil(recordAudit({ action: "ticket.status_changed", target: ticket.ref, projectId, metadata: { status } }))
  revalidatePath("/dashboard/tickets")
}

export async function assignTicket(ticketId: string, assigneeId: string | null, assigneeEmail: string | null): Promise<void> {
  await requireCapability("tickets")
  const { supabase, projectId, ticket } = await ownedTicket(ticketId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("tickets")
    .update({ assignee_id: assigneeId, assignee_email: assigneeEmail, updated_at: new Date().toISOString() })
    .eq("id", ticketId)
  await addEvent(supabase, ticketId, projectId, {
    kind: "assigned",
    body: assigneeEmail ?? "unassigned",
  })
  waitUntil(recordAudit({ action: "ticket.assigned", target: ticket.ref, projectId, metadata: { assigneeEmail } }))
  revalidatePath("/dashboard/tickets")
}

export async function setTicketPriority(ticketId: string, priority: TicketPriority): Promise<void> {
  await requireCapability("tickets")
  const { supabase, projectId, ticket } = await ownedTicket(ticketId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).from("tickets")
    .update({ priority, updated_at: new Date().toISOString() })
    .eq("id", ticketId)
  await addEvent(supabase, ticketId, projectId, { kind: "priority_changed", body: priority })
  waitUntil(recordAudit({ action: "ticket.priority_changed", target: ticket.ref, projectId, metadata: { priority } }))
  revalidatePath("/dashboard/tickets")
}

/**
 * Record something said to the user, or a pointer to where it lives.
 *
 * TxID does not send the email. Someone replies from their own mailbox, or
 * from a CRM, and logs it here. That is deliberately manual for now: automatic
 * capture needs an inbound email domain and a parser, which is a separate
 * build. Manual is not the same as useless, because the alternative today is a
 * trail that simply stops at "escalated" and resumes nowhere.
 */
export async function logTicketComm(
  ticketId: string,
  input: { kind: "note" | "reply" | "link"; channel?: EventChannel; body?: string; url?: string },
): Promise<void> {
  await requireCapability("tickets")
  const { supabase, projectId, ticket } = await ownedTicket(ticketId)
  if (!input.body?.trim() && !input.url?.trim()) throw new Error("Nothing to record")
  await addEvent(supabase, ticketId, projectId, {
    kind: input.kind,
    channel: input.channel ?? null,
    body: input.body?.trim() || null,
    url: input.url?.trim() || null,
  })
  // A reply is the first response if nothing else has been.
  if (input.kind === "reply" && !ticket.first_response_at) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from("tickets")
      .update({ first_response_at: new Date().toISOString() })
      .eq("id", ticketId)
  }
  waitUntil(recordAudit({
    action: input.kind === "reply" ? "ticket.replied" : "ticket.annotated",
    target: ticket.ref,
    projectId,
    metadata: { kind: input.kind, channel: input.channel ?? null },
  }))
  revalidatePath("/dashboard/tickets")
}

export async function getTicketEvents(ticketId: string): Promise<TicketEvent[]> {
  const { supabase } = await ownedTicket(ticketId)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabase as any)
    .from("ticket_events")
    .select("id, kind, channel, body, url, actor_email, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ((data ?? []) as any[]).map(r => ({
    id: r.id, kind: r.kind, channel: r.channel ?? null, body: r.body ?? null,
    url: r.url ?? null, actorEmail: r.actor_email ?? null, createdAt: r.created_at,
  }))
}
