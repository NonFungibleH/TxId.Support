import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import type { ProjectConfig } from "@/lib/types/config"
import type { Finding } from "@/components/dashboard/FindingList"
import { TesterReports } from "@/components/dashboard/TesterReports"

export const dynamic = "force-dynamic"

interface ProjectRow { id: string; config: ProjectConfig }

/**
 * What testers have told you.
 *
 * ITS OWN PAGE, under Monitor rather than inside the beta setup screen. It was
 * a card at the foot of /dashboard/beta, which is a page you visit once to
 * configure something and then never open again. Findings are the OPPOSITE:
 * they arrive continuously and are the reason the programme exists, so they
 * belong beside Conversations and Tickets, not below a settings form.
 *
 * Deliberately separate from Tickets. `getTickets` filters `reason.neq.feedback`
 * because a tester saying "the fee display is confusing" is not waiting for a
 * reply, and mixing the two turns a support queue into a suggestions box.
 */
export default async function FindingsPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: findings } = await (supabase as any)
    .from("tickets")
    .select("id, ref, summary, created_at, conversation, reason, wallet_address")
    .eq("project_id", typedProject.id)
    .in("reason", ["feedback", "bug"])
    .order("created_at", { ascending: false })
    .limit(200)

  const rows = (findings ?? []) as (Finding & { reason: string })[]
  const bugs = rows.filter(r => r.reason === "bug")
  const feedback = rows.filter(r => r.reason !== "bug")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Findings</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          What your testers reported from inside the product, in their own words. Each one keeps the
          conversation that produced it, so you can see what they were doing when they hit it. These
          are deliberately kept out of Tickets: nobody here is waiting for a reply.
        </p>
      </div>

      <TesterReports bugs={bugs} feedback={feedback} />
    </div>
  )
}
