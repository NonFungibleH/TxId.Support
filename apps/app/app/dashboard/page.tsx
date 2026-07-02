import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { StatsCard } from "@/components/dashboard/StatsCard"
import {
  MessageSquare, Users, Zap, Globe, ArrowRight, CheckCircle2, Paintbrush, Code,
} from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { GoLiveToggle } from "@/components/dashboard/GoLiveToggle"
import { ProjectNameEditor } from "@/components/dashboard/ProjectNameEditor"
import type { ProjectConfig } from "@/lib/types/config"
import { PLAN_CHAIN_LIMITS, PLAN_CONV_LIMITS, SUPPORTED_CHAINS } from "@/lib/types/config"
import type { Database } from "@/lib/supabase/types"
import { cn } from "@/lib/utils"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

// Include both hex and decimal chain ID forms — DB may store either
const CHAIN_NAMES: Record<string, string> = {
  ...Object.fromEntries(SUPPORTED_CHAINS.map(c => [c.id, c.name])),
  "1": "Ethereum", "8453": "Base", "56": "BNB Chain",
  "137": "Polygon", "42161": "Arbitrum", "10": "Optimism",
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default async function DashboardPage() {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")

  const typedProject = project as unknown as ProjectRow
  const supabase = createServiceClient()

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [convResult, docsResult, walletsResult, monthlyResult, recentResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
    supabase
      .from("conversations")
      .select("wallet_address")
      .eq("project_id", typedProject.id)
      .not("wallet_address", "is", null),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("conversations")
      .select("id, wallet_address, chain_id, created_at, messages(role, content, created_at)")
      .eq("project_id", typedProject.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ])

  const uniqueWallets = new Set(
    (walletsResult.data ?? []).map((r) => (r as { wallet_address: string }).wallet_address)
  ).size

  const config = typedProject.config as unknown as ProjectConfig
  const docCount = docsResult.count ?? 0
  const monthlyCount = monthlyResult.count ?? 0
  const recentConvs = recentResult.data ?? []

  const plan = config.plan ?? "free"
  const chainLimit = PLAN_CHAIN_LIMITS[plan]
  const convLimit = PLAN_CONV_LIMITS[plan]
  const chainLimitLabel = chainLimit === Infinity ? String(SUPPORTED_CHAINS.length) : String(chainLimit)
  const convLimitLabel = convLimit === Infinity ? null : convLimit.toLocaleString()
  const usagePct = convLimit === Infinity ? 0 : Math.round((monthlyCount / convLimit) * 100)

  // Derive active chains from contracts + token (no longer manually configured)
  const activeChains = [...new Set([
    ...(config.watchedContracts ?? []).map(c => c.chain as string),
    ...(config.token?.chain ? [config.token.chain as string] : []),
  ])]

  const brandingDone = config.branding.logoUrl !== null || config.branding.primaryColor !== "#6366f1"
  const contractsDone = (config.watchedContracts ?? []).length > 0
  const docsDone = docCount > 0
  const previewDone = config.previewConfirmed === true
  const liveDone = typedProject.is_active === true

  const SETUP_STEPS = [
    {
      step: 1,
      href: "/dashboard/contracts",
      label: "Add smart contracts",
      desc: "Add your protocol's contracts so the AI can look them up when users ask about locks, staking, or vesting.",
      time: "~2 min",
      done: contractsDone,
    },
    {
      step: 2,
      href: "/dashboard/docs",
      label: "Index your docs",
      desc: "Paste links to your website, docs, or FAQ — the AI reads them and answers questions from them.",
      time: "~3 min",
      done: docsDone,
    },
    {
      step: 3,
      href: "/dashboard/branding",
      label: "Configure branding",
      desc: "Set your colours, font, and upload your logo so the agent feels like yours.",
      time: "~5 min",
      done: brandingDone,
    },
    {
      step: 4,
      href: "/dashboard/preview",
      label: "Preview & approve",
      desc: "Open the live preview, test it on your own site, then confirm the design.",
      time: "~5 min",
      done: previewDone,
    },
    {
      step: 5,
      href: "/dashboard/embed",
      label: "Embed & go live",
      desc: "Copy the one-line snippet into your site, then flip the switch to publish.",
      time: "~2 min",
      done: liveDone,
    },
  ]

  const completedSteps = SETUP_STEPS.filter(s => s.done).length
  const nextStep = SETUP_STEPS.find(s => !s.done)

  const QUICK_ACTIONS = [
    { label: "Edit branding", href: "/dashboard/branding", icon: Paintbrush },
    { label: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
    { label: "Embed settings", href: "/dashboard/embed", icon: Code },
  ]

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
        <StatsCard title="Chains enabled" value={activeChains.length} description={`of ${chainLimitLabel} on ${plan}`} icon={Zap} />
      </div>

      {liveDone ? (
        <div className="space-y-4">
          {/* Monthly usage */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Conversations this month</p>
              <span className="text-sm tabular-nums">
                <span className="font-semibold">{monthlyCount.toLocaleString()}</span>
                {convLimitLabel && (
                  <span className="text-muted-foreground font-normal"> / {convLimitLabel}</span>
                )}
              </span>
            </div>
            {convLimitLabel ? (
              <>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      usagePct >= 90 ? "bg-amber-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(usagePct, 100)}%` }}
                  />
                </div>
                {usagePct >= 80 && (
                  <p className="text-xs text-amber-400 mt-2.5">
                    {usagePct >= 100
                      ? "You've hit your monthly limit — conversations are paused. "
                      : `${usagePct}% used — `}
                    <a
                      href="mailto:hello@txid.support?subject=Upgrade enquiry"
                      className="underline underline-offset-2 hover:text-amber-300"
                    >
                      Upgrade to avoid interruptions →
                    </a>
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Unlimited conversations on your plan.</p>
            )}
          </div>

          {/* Recent conversations */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
              <p className="text-sm font-medium">Recent conversations</p>
              <Link
                href="/dashboard/conversations"
                className="text-xs text-muted-foreground hover:text-white transition-colors"
              >
                View all →
              </Link>
            </div>
            {recentConvs.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <p className="text-sm text-muted-foreground">No conversations yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Share your{" "}
                  <Link
                    href="/dashboard/embed"
                    className="underline underline-offset-2 hover:text-muted-foreground"
                  >
                    embed snippet
                  </Link>{" "}
                  to start getting users.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentConvs.map(conv => {
                  const c = conv as {
                    id: string
                    wallet_address: string | null
                    chain_id: string | null
                    created_at: string
                    messages: { role: string; content: string; created_at: string }[]
                  }
                  const wallet = c.wallet_address
                    ? `${c.wallet_address.slice(0, 6)}…${c.wallet_address.slice(-4)}`
                    : "Anonymous"
                  const chain = c.chain_id ? (CHAIN_NAMES[c.chain_id] ?? c.chain_id) : null
                  const firstMsg = (c.messages ?? [])
                    .filter(m => m.role === "user")
                    .sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
                  const preview = firstMsg?.content?.slice(0, 80).replace(/\n/g, " ")
                  return (
                    <div key={c.id} className="flex items-start gap-3 px-5 py-3.5">
                      <div className="size-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <Users className="size-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-mono truncate">{wallet}</p>
                          {chain && <span className="text-xs text-muted-foreground/60 shrink-0">{chain}</span>}
                        </div>
                        {preview && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{preview}{firstMsg.content.length > 80 ? "…" : ""}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 tabular-nums mt-0.5">
                        {timeAgo(c.created_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3">
            {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 text-sm font-medium hover:border-primary/50 hover:bg-accent/10 transition-all group"
              >
                <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        /* Setup checklist — shown until the user goes live */
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
                <Link key={href} href={href} prefetch className="block group">
                  <div
                    className={cn(
                      "rounded-xl border p-5 transition-all hover:border-primary/50",
                      done  ? "border-green-500/20 bg-green-500/[0.04]" :
                      isNext ? "border-indigo-500/40 bg-indigo-500/[0.06]" : ""
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                          done  ? "bg-green-500/15 text-green-500" :
                          isNext ? "bg-indigo-500/20 text-indigo-400" :
                          "bg-muted/50 text-muted-foreground/30"
                        )}
                      >
                        {done ? <CheckCircle2 className="size-5" /> : step}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className={`font-semibold text-sm ${done ? "text-muted-foreground" : ""}`}>
                            {label}
                          </p>
                          {done && (
                            <span className="shrink-0 text-xs font-medium text-green-500">Done ✓</span>
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
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
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
      )}
    </div>
  )
}
