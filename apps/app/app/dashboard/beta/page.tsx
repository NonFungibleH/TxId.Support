import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import Link from "next/link"
import { createServiceClient } from "@/lib/supabase/server"
import { BetaProgrammeForm } from "@/components/settings/BetaProgrammeForm"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Circle, AlertTriangle, MessageSquare, Users, CalendarClock } from "lucide-react"
import type { ProjectConfig } from "@/lib/types/config"
import { activeBeta } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

/**
 * A programme, not a setting.
 *
 * WHY ITS OWN PAGE: this began life as a toggle at the bottom of the Persona
 * page, which told a customer "we bolted this on for you". The capability was
 * never a workaround, it layers exactly like service updates, but a switch
 * under somebody else's heading reads as one.
 *
 * The page is ordered as the SETUP ITSELF rather than as a settings dump: what
 * is ready, what is missing, then the controls, then what the programme has
 * collected. Readiness comes first because the failure that would actually
 * embarrass a protocol is an assistant that opens itself in a tester's face,
 * offers to help, and has nothing indexed to help with.
 */
export default async function BetaPage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig
  const live = activeBeta(config)
  const supabase = createServiceClient()

  // Is there anything to answer FROM? The single most important readiness
  // check, and the one a protocol is most likely to skip.
  const { count: docCount } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("project_id", typedProject.id)

  const hasIntro = !!config.beta?.intro?.trim()
  const hasQuestions = (config.suggestedQuestions ?? []).some(q => q.trim().length > 0)
  const hasDocs = (docCount ?? 0) > 0
  const hasContracts = (config.watchedContracts ?? []).length > 0

  // Programme results. NOT scoped to the beta's start date: conversations
  // carry no beta marker, so a "since" filter would be a guess dressed as a
  // fact. Counting everything is honest and the label says "Conversations",
  // not "Testers". Scoping properly needs the run recorded on the row.
  const { count: conversationCount } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", typedProject.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: findings } = await (supabase as any)
    .from("tickets")
    .select("id, ref, summary, created_at")
    .eq("project_id", typedProject.id)
    .eq("reason", "feedback")
    .order("created_at", { ascending: false })
    .limit(8)

  const findingRows = (findings ?? []) as Array<{ id: string; ref: string; summary: string; created_at: string }>

  const daysLeft = live?.endsAt
    ? Math.max(0, Math.ceil((Date.parse(live.endsAt) - Date.now()) / 86_400_000))
    : null

  const steps = [
    { done: config.beta?.enabled === true, label: "Turn the programme on", detail: "Below." },
    { done: hasDocs, label: "Give it something to read", detail: "Your beta guide, docs, or pasted text.", href: "/dashboard/docs", critical: true },
    { done: hasIntro, label: "Write the introduction", detail: "What a tester sees when it opens itself." },
    { done: hasQuestions, label: "Set the starter questions", detail: "The things you want every tester to try.", href: "/dashboard/persona" },
    { done: hasContracts, label: "Add your contracts", detail: "So it can diagnose failed transactions, not just answer questions.", href: "/dashboard/contracts" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Beta programme</h1>
        <p className="text-muted-foreground mt-1">
          Run the assistant for testers: it introduces itself, answers their questions, and collects
          what they tell you.
        </p>
      </div>

      {/* Live strip. Only when a programme is actually running, so it is never
          decoration. */}
      {live && (
        <div className="grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <Users className="size-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold">{conversationCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Conversations</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <MessageSquare className="size-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold">{findingRows.length}</p>
                <p className="text-xs text-muted-foreground">Findings collected</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <CalendarClock className="size-4 text-muted-foreground" />
              <div>
                <p className="text-lg font-semibold">{daysLeft === null ? "No end date" : `${daysLeft}d`}</p>
                <p className="text-xs text-muted-foreground">
                  {daysLeft === null ? "Runs until switched off" : "Remaining"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Readiness. FIRST, because polish on a bot with nothing to say is worse
          than no polish. */}
      <Card>
        <CardHeader>
          <CardTitle>Before you invite testers</CardTitle>
          <CardDescription>
            The assistant answers from what you have given it plus what is on chain. Everything here
            is worth having, but the second one decides whether this works at all.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {steps.map(s => (
            <div key={s.label} className="flex items-start gap-2.5">
              {s.done
                ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                : s.critical
                  ? <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  : <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
              <div className="text-sm">
                <span className={s.done ? "text-muted-foreground line-through" : "font-medium"}>
                  {s.label}
                </span>
                <span className="text-xs text-muted-foreground"> {s.detail}</span>
                {!s.done && s.href && (
                  <Link href={s.href} className="ml-1 text-xs font-medium underline underline-offset-2">
                    Open
                  </Link>
                )}
              </div>
            </div>
          ))}
          {!hasDocs && (
            <p className="pt-1 text-xs text-amber-600">
              Nothing is indexed yet. A widget that opens itself, offers to help and then cannot
              answer makes a worse impression than no widget, so index something before you turn on
              the introduction.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Everything the assistant already does keeps working, including live transaction
            diagnosis. This adds to it rather than replacing it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BetaProgrammeForm initial={config.beta} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What testers have told you</CardTitle>
          <CardDescription>
            Feedback recorded through the widget, newest first. Each one keeps the conversation that
            produced it, so you can see what they were doing when they said it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {findingRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing recorded yet. Findings appear here as soon as a tester uses Leave feedback.
            </p>
          ) : (
            <div className="space-y-2">
              {findingRows.map(f => (
                <Link
                  key={f.id}
                  href="/dashboard/tickets"
                  className="block rounded-md border border-border px-3 py-2 transition-colors hover:bg-muted/40"
                >
                  <p className="text-sm">{f.summary}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{f.ref}</p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
