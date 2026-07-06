import { getProject } from "@/lib/actions/project"
import { createServiceClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Zap, CreditCard, BarChart3 } from "lucide-react"
import Link from "next/link"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_LABELS, PLAN_CHAIN_LIMITS, PLAN_CONV_LIMITS, PAID_PLANS, SUPPORTED_CHAINS } from "@/lib/types/config"
import { cn } from "@/lib/utils"
import type { Database } from "@/lib/supabase/types"
import { OrgNameEditor } from "@/components/dashboard/OrgNameEditor"
import { isStripeConfigured } from "@/lib/stripe"
import { ManageBillingButton } from "@/components/settings/BillingButtons"

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"]

const PLAN_COLOR: Record<Plan, string> = {
  free:       "bg-muted text-muted-foreground",
  starter:    "bg-indigo-500/20 text-indigo-400",
  pro:        "bg-amber-500/20 text-amber-400",
  enterprise: "bg-purple-500/20 text-purple-400",
  custom:     "bg-emerald-500/20 text-emerald-400",
  demo:       "bg-cyan-500/20 text-cyan-400",
}

export default async function AccountPage() {
  const { org, project } = await getProject()
  if (!project) redirect("/dashboard")

  const typedProject = project as unknown as ProjectRow
  const config = typedProject.config as unknown as ProjectConfig
  const plan: Plan = config.plan ?? "free"
  const supabase = createServiceClient()

  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [monthlyResult, totalResult, docsResult] = await Promise.all([
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("project_id", typedProject.id),
  ])

  const monthlyCount = monthlyResult.count ?? 0
  const totalConvs = totalResult.count ?? 0
  const docCount = docsResult.count ?? 0

  const convLimit = PLAN_CONV_LIMITS[plan]
  const chainLimit = PLAN_CHAIN_LIMITS[plan]
  const convLimitLabel = convLimit === Infinity ? "Unlimited" : convLimit.toLocaleString()
  const chainLimitLabel = chainLimit === Infinity ? String(SUPPORTED_CHAINS.length) : String(chainLimit)
  const usagePct = convLimit === Infinity ? 0 : Math.round((monthlyCount / convLimit) * 100)
  const chainsUsed = new Set([
    ...(config.watchedContracts ?? []).map(c => c.chain as string),
    ...(config.token?.chain ? [config.token.chain as string] : []),
  ]).size

  const isPaid = PAID_PLANS.includes(plan)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <OrgNameEditor initialName={org.name} />
          <p className="text-muted-foreground mt-1">Plan, usage, and billing details.</p>
        </div>
      </div>

      {/* Current plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", PLAN_COLOR[plan])}>
                  {PLAN_LABELS[plan]}
                </span>
                Plan
              </CardTitle>
              <CardDescription className="mt-1">
                {chainLimitLabel} {chainLimit === 1 ? "chain" : "chains"} · {convLimitLabel} conversations / month
              </CardDescription>
            </div>
            {!isPaid && (
              <Link
                href="/dashboard/upgrade"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Zap className="size-3.5" />
                Upgrade
              </Link>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Usage this month */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-muted-foreground" />
            Usage this month
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Conversations */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Conversations</p>
              <span className="text-sm tabular-nums">
                <span className={cn("font-semibold", usagePct >= 90 && "text-amber-400")}>
                  {monthlyCount.toLocaleString()}
                </span>
                {convLimit !== Infinity && (
                  <span className="text-muted-foreground"> / {convLimitLabel}</span>
                )}
              </span>
            </div>
            {convLimit !== Infinity ? (
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
                  <p className="mt-2 text-xs text-amber-400">
                    {usagePct >= 100
                      ? "Limit reached — conversations are paused. "
                      : `${usagePct}% used — `}
                    <Link href="/dashboard/upgrade" className="underline underline-offset-2 hover:text-amber-300">
                      Upgrade to continue →
                    </Link>
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Unlimited on your plan.</p>
            )}
          </div>

          {/* Chains */}
          <div className="flex items-center justify-between py-3 border-t border-border">
            <div>
              <p className="text-sm font-medium">Chains enabled</p>
              <p className="text-xs text-muted-foreground mt-0.5">Active blockchains on your project</p>
            </div>
            <span className="text-sm tabular-nums font-semibold">
              {chainsUsed}
              {chainLimit !== Infinity && (
                <span className="font-normal text-muted-foreground"> / {chainLimitLabel}</span>
              )}
            </span>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-2 gap-4 pt-1 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground">Total conversations</p>
              <p className="text-lg font-semibold tabular-nums">{totalConvs.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Knowledge docs</p>
              <p className="text-lg font-semibold tabular-nums">{docCount.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4 text-muted-foreground" />
            Billing
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPaid ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You&apos;re on the <strong>{PLAN_LABELS[plan]}</strong> plan.
                {isStripeConfigured()
                  ? " Update your card, view invoices, or cancel any time."
                  : " Contact us for any billing queries."}
              </p>
              <ManageBillingButton
                stripeEnabled={isStripeConfigured()}
                fallbackHref="mailto:hello@txid.support?subject=Billing enquiry"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                You&apos;re on the free plan. Upgrade to unlock more conversations, additional chains, and priority support.
              </p>
              <Link
                href="/dashboard/upgrade"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Zap className="size-3.5" />
                View upgrade options →
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
