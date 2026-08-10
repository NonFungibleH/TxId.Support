import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { ProjectConfig } from "@/lib/types/config"
import { FindingList, type Finding } from "@/components/dashboard/FindingList"

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
    .select("id, ref, summary, created_at, conversation")
    .eq("project_id", typedProject.id)
    .eq("reason", "feedback")
    .order("created_at", { ascending: false })
    .limit(100)

  const rows = (findings ?? []) as Finding[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Tester findings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rows.length === 0
            ? "Feedback recorded through the widget appears here."
            : `${rows.length} recorded, newest first.`}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What testers have told you</CardTitle>
          <CardDescription>
            Each one keeps the conversation that produced it, so you can see what they were doing
            when they said it. These are kept out of Tickets on purpose: a tester sharing an opinion
            is not waiting for a reply, and mixing the two would bury the people who are.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FindingList
            findings={rows}
            emptyHint="Findings appear as soon as a tester uses Leave feedback in the widget."
          />
        </CardContent>
      </Card>
    </div>
  )
}
