import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { StatsCard } from "@/components/dashboard/StatsCard"
import { MessageSquare, Users, Zap, Globe, ArrowRight, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { GoLiveToggle } from "@/components/dashboard/GoLiveToggle"
import { ProjectNameEditor } from "@/components/dashboard/ProjectNameEditor"
import type { ProjectConfig } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

export default async function DashboardPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()

  const [convResult, docsResult, walletsResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
    // P6: distinct connected wallets — genuinely different from total conversations
    supabase
      .from("conversations")
      .select("wallet_address")
      .eq("project_id", typedProject.id)
      .not("wallet_address", "is", null),
  ])

  const uniqueWallets = new Set(
    (walletsResult.data ?? []).map((r) => (r as { wallet_address: string }).wallet_address)
  ).size

  const config = typedProject.config as unknown as ProjectConfig
  const docCount = docsResult.count ?? 0

  const brandingDone = config.branding.logoUrl !== null || config.branding.primaryColor !== "#6366f1"
  const contractsDone = (config.watchedContracts ?? []).length > 0
  const docsDone = docCount > 0
  const previewDone = config.previewConfirmed === true
  const liveDone = typedProject.is_active === true

  const SETUP_STEPS = [
    {
      step: 1,
      href: "/dashboard/branding",
      label: "Configure branding",
      desc: "Set your colours, font, and upload your logo so the agent feels like yours.",
      time: "~5 min",
      done: brandingDone,
    },
    {
      step: 2,
      href: "/dashboard/contracts",
      label: "Add smart contracts",
      desc: "Add your protocol's contracts so the AI can look them up when users ask about locks, staking, or vesting.",
      time: "~2 min",
      done: contractsDone,
    },
    {
      step: 3,
      href: "/dashboard/docs",
      label: "Index your docs",
      desc: "Paste links to your website, docs, or FAQ — the AI reads them and answers questions from them.",
      time: "~3 min",
      done: docsDone,
    },
    {
      step: 4,
      href: "/dashboard/chains",
      label: "Enable chains",
      desc: "Choose which blockchains the agent scans when a user connects their wallet.",
      time: "~1 min",
      done: config.chains.length > 0,
    },
    {
      step: 5,
      href: "/dashboard/preview",
      label: "Preview & approve",
      desc: "Open the live preview, test it on your own site, then confirm the design.",
      time: "~5 min",
      done: previewDone,
    },
    {
      step: 6,
      href: "/dashboard/embed",
      label: "Embed & go live",
      desc: "Copy the one-line snippet into your site, then flip the switch to publish.",
      time: "~2 min",
      done: liveDone,
    },
  ]

  const completedSteps = SETUP_STEPS.filter(s => s.done).length
  const nextStep = SETUP_STEPS.find(s => !s.done)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <ProjectNameEditor projectId={typedProject.id} initialName={typedProject.name} />
        <GoLiveToggle projectId={typedProject.id} isActive={typedProject.is_active} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
        <StatsCard title="Conversations" value={convResult.count ?? 0} description="All time" icon={MessageSquare} />
        <StatsCard title="Connected wallets" value={uniqueWallets} description="Unique addresses" icon={Users} />
        <StatsCard title="Knowledge docs" value={docCount} description="Indexed chunks" icon={Globe} />
        <StatsCard title="Chains enabled" value={config.chains.length} description={`of ${7} supported`} icon={Zap} />
      </div>

      {/* Setup steps */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Getting started</h2>
            <p className="text-sm text-muted-foreground">
              {completedSteps === SETUP_STEPS.length
                ? "All steps complete — your agent is live."
                : `${completedSteps} of ${SETUP_STEPS.length} steps complete`}
            </p>
          </div>
          {/* Progress bar — shown on sm+ as bar, always shown as % on mobile */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:block w-32 h-1.5 rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary transition-all"
                style={{ width: `${(completedSteps / SETUP_STEPS.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums font-medium">
              {Math.round((completedSteps / SETUP_STEPS.length) * 100)}%
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {SETUP_STEPS.map(({ href, label, desc, time, done, step }) => {
            const isNext = nextStep?.step === step

            return (
              <Link
                key={href}
                href={href}
                className="block group"
              >
                <div
                  className="rounded-xl border p-5 transition-all hover:border-primary/50"
                  style={{
                    borderColor: done
                      ? "rgba(34,197,94,0.2)"
                      : isNext
                      ? "rgba(99,102,241,0.4)"
                      : undefined,
                    background: done
                      ? "rgba(34,197,94,0.04)"
                      : isNext
                      ? "rgba(99,102,241,0.06)"
                      : undefined,
                  }}
                >
                  <div className="flex items-start gap-4">
                    {/* Step indicator */}
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                      style={{
                        background: done
                          ? "rgba(34,197,94,0.15)"
                          : isNext
                          ? "rgba(99,102,241,0.2)"
                          : "rgba(255,255,255,0.05)",
                        color: done
                          ? "rgb(34,197,94)"
                          : isNext
                          ? "rgb(129,140,248)"
                          : "rgba(255,255,255,0.3)",
                      }}
                    >
                      {done ? <CheckCircle2 className="size-5" /> : step}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <p className={`font-semibold text-sm ${done ? "text-muted-foreground" : ""}`}>
                          {label}
                        </p>
                        {done && (
                          <span className="shrink-0 text-xs font-medium text-green-500">
                            Done ✓
                          </span>
                        )}
                        {isNext && (
                          <span className="shrink-0 flex items-center gap-1 text-xs font-medium text-primary">
                            Start here <ArrowRight className="size-3" />
                          </span>
                        )}
                        {!done && !isNext && (
                          <ArrowRight className="size-4 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {desc}
                      </p>
                      {!done && (
                        <p className="text-[10px] text-muted-foreground/50 mt-1 font-mono">{time}</p>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
