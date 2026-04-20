import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { MessageSquare, Users, Zap, Globe, ArrowRight, CheckCircle2, Circle } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function DashboardPage() {
  const { project } = await getProject()

  if (!project) {
    redirect("/onboarding")
  }

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()

  const [convResult, docsResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
  ])

  const config = typedProject.config as unknown as ProjectConfig
  const docCount = docsResult.count ?? 0

  // Completion checks
  const brandingDone = config.branding.logoUrl !== null || config.branding.primaryColor !== "#6366f1"
  const contractsDone = (config.watchedContracts ?? []).length > 0
  const docsDone = docCount > 0
  const previewDone = false // always prompt to preview
  const liveDone = typedProject.is_active

  const SETUP_STEPS = [
    {
      step: 1,
      href: "/dashboard/branding",
      label: "Configure branding",
      desc: "Set your colours, font, and logo",
      done: brandingDone,
    },
    {
      step: 2,
      href: "/dashboard/contracts",
      label: "Add smart contracts",
      desc: "So the AI can look them up for users",
      done: contractsDone,
    },
    {
      step: 3,
      href: "/dashboard/docs",
      label: "Index your docs",
      desc: "Add URLs to your docs, FAQ, or website",
      done: docsDone,
    },
    {
      step: 4,
      href: "/dashboard/preview",
      label: "Preview the widget",
      desc: "Test it before your users see it",
      done: previewDone,
    },
    {
      step: 5,
      href: "/dashboard/embed",
      label: "Embed & go live",
      desc: "Copy the snippet and publish",
      done: liveDone,
    },
  ]

  const completedSteps = SETUP_STEPS.filter(s => s.done).length
  const allDone = completedSteps === SETUP_STEPS.length

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{typedProject.name}</h1>
          <p className="font-mono text-xs text-muted-foreground mt-1">
            {typedProject.publishable_key}
          </p>
        </div>
        <Badge variant={typedProject.is_active ? "default" : "secondary"}>
          {typedProject.is_active ? "● Live" : "○ Not live"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatsCard title="Conversations" value={convResult.count ?? 0} description="All time" icon={MessageSquare} />
        <StatsCard title="Users helped" value={convResult.count ?? 0} description="Unique sessions" icon={Users} />
        <StatsCard title="Knowledge docs" value={docCount} description="Indexed chunks" icon={Globe} />
        <StatsCard title="Chains enabled" value={config.chains.length} description="of 7 supported" icon={Zap} />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Getting started</CardTitle>
              <CardDescription>
                {allDone
                  ? "All steps complete — your widget is ready."
                  : `${completedSteps} of ${SETUP_STEPS.length} steps complete`}
              </CardDescription>
            </div>
            {completedSteps > 0 && (
              <div className="text-xs text-muted-foreground">
                {Math.round((completedSteps / SETUP_STEPS.length) * 100)}%
              </div>
            )}
          </div>
          {/* Progress bar */}
          <div className="h-1.5 w-full rounded-full bg-muted mt-2">
            <div
              className="h-1.5 rounded-full bg-primary transition-all"
              style={{ width: `${(completedSteps / SETUP_STEPS.length) * 100}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="grid gap-2">
          {SETUP_STEPS.map(({ href, label, desc, done, step }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-4 rounded-lg border border-border px-4 py-3 text-sm hover:bg-accent/50 transition-colors"
            >
              {done
                ? <CheckCircle2 className="size-5 shrink-0 text-green-500" />
                : <Circle className="size-5 shrink-0 text-muted-foreground/40" />
              }
              <div className="flex-1 min-w-0">
                <p className={done ? "font-medium line-through text-muted-foreground" : "font-medium"}>
                  {step}. {label}
                </p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              {!done && <ArrowRight className="size-4 shrink-0 text-muted-foreground" />}
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
