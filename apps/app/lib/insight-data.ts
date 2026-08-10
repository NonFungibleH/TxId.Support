import { cache } from "react"
import { createServiceClient } from "@/lib/supabase/server"
import { computeInsights, type InsightWindow, type Insights, type WindowConversation, type WindowMessage, type WindowTicket } from "@/lib/insights"

/**
 * The one read behind every aggregate view on Analytics.
 *
 * WHY IT IS SHARED, AND WHY IT IS `cache()`d. The gaps report and the pilot
 * insights want the same rows: a window of conversations, every message in
 * them, and the tickets raised from them. Two builders each running their own
 * query would double the cost of the heaviest page in the dashboard for no
 * benefit, and the busiest account would pay the most.
 *
 * React's `cache()` dedupes per request, so both builders call this and only
 * the first one hits the database. That keeps each builder independently
 * callable, which a shared parameter would not: passing the rows in would mean
 * every future caller has to know how to load them first.
 *
 * BOUNDED ON PURPOSE. 2000 conversations, and the message read is keyed on the
 * ids that came back, so a large account degrades to "the most recent 2000"
 * rather than to an unbounded scan. Say so where it matters rather than
 * silently truncating: `truncated` is returned for exactly that.
 */

const CONVERSATION_CAP = 2000

export const loadInsightWindow = cache(
  async (projectId: string, days: number): Promise<InsightWindow> => {
    const supabase = createServiceClient()
    const since = new Date()
    since.setDate(since.getDate() - days)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: conversations } = await (supabase as any)
      .from("conversations")
      .select("id, created_at, summary, category, sentiment")
      .eq("project_id", projectId)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(CONVERSATION_CAP)

    const convs = (conversations ?? []) as WindowConversation[]
    if (convs.length === 0) {
      return { conversations: [], messages: [], tickets: [], truncated: false }
    }

    const convIds = convs.map(c => c.id)

    const [messagesRes, ticketsRes] = await Promise.all([
      // `evidence` predates nothing, but a deployment can run ahead of its
      // migration, so a failed select falls back to the columns that have
      // always existed rather than emptying the whole page.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("messages")
        .select("conversation_id, role, content, created_at, feedback, evidence")
        .in("conversation_id", convIds)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((res: any) =>
          res.error
            ? supabase
                .from("messages")
                .select("conversation_id, role, content, created_at, feedback")
                .in("conversation_id", convIds)
            : res,
        ),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("tickets")
        .select("id, ref, conversation_id, reason, created_at")
        .in("conversation_id", convIds)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .then((res: any) =>
          res.error
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ? (supabase as any).from("tickets").select("conversation_id").in("conversation_id", convIds)
            : res,
        ),
    ])

    return {
      conversations: convs,
      messages: (messagesRes?.data ?? []) as WindowMessage[],
      tickets: (ticketsRes?.data ?? []) as WindowTicket[],
      truncated: convs.length >= CONVERSATION_CAP,
    }
  },
)

/**
 * The pilot insights, loaded and computed.
 *
 * A thin wrapper on purpose: everything worth getting right is in
 * `computeInsights`, which is pure and tested directly.
 */
export async function buildInsights(
  projectId: string,
  days: number,
  sessionCap?: number,
): Promise<Insights> {
  return computeInsights(await loadInsightWindow(projectId, days), days, sessionCap)
}

export type { InsightWindow, WindowConversation, WindowMessage, WindowTicket }
