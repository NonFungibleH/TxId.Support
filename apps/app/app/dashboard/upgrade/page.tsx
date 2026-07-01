import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { CheckCircle2, Zap } from "lucide-react"
import Link from "next/link"
import type { ProjectConfig, Plan } from "@/lib/types/config"
import { PLAN_CONV_LIMITS, PLAN_CHAIN_LIMITS } from "@/lib/types/config"
import { cn } from "@/lib/utils"

type PlanDef = {
  id: Plan
  label: string
  price: string
  priceSub: string
  chains: string
  convs: string
  features: string[]
  cta: string
  ctaHref: string
  highlight: boolean
}

const PLANS: PlanDef[] = [
  {
    id: "free",
    label: "Free",
    price: "$0",
    priceSub: "forever",
    chains: "1 chain",
    convs: `${PLAN_CONV_LIMITS.free} conversations/mo`,
    features: [
      "1 blockchain",
      "50 conversations / month",
      "Content blocks",
      "Smart contract lookups",
      "Docs & knowledge base",
      "Community support",
    ],
    cta: "Current plan",
    ctaHref: "#",
    highlight: false,
  },
  {
    id: "starter",
    label: "Starter",
    price: "Contact us",
    priceSub: "per month",
    chains: "1 chain",
    convs: `${PLAN_CONV_LIMITS.starter.toLocaleString()} conversations/mo`,
    features: [
      "1 blockchain",
      "200 conversations / month",
      "All content blocks",
      "Smart contract lookups",
      "Docs & knowledge base",
      "Email support",
    ],
    cta: "Get Starter",
    ctaHref: "mailto:hello@txid.support?subject=Upgrade to Starter",
    highlight: false,
  },
  {
    id: "pro",
    label: "Pro",
    price: "$699",
    priceSub: "per month",
    chains: "3 chains",
    convs: `${PLAN_CONV_LIMITS.pro.toLocaleString()} conversations/mo`,
    features: [
      "3 blockchains",
      "5,000 conversations / month",
      "All content blocks",
      "Smart contract lookups",
      "Docs & knowledge base",
      "Priority support",
      "Advanced analytics",
    ],
    cta: "Get Pro",
    ctaHref: "mailto:hello@txid.support?subject=Upgrade to Pro",
    highlight: true,
  },
  {
    id: "enterprise",
    label: "Enterprise",
    price: "Custom",
    priceSub: "tailored pricing",
    chains: "Unlimited chains",
    convs: "Unlimited conversations",
    features: [
      "Unlimited blockchains",
      "Unlimited conversations",
      "All content blocks",
      "Smart contract lookups",
      "Docs & knowledge base",
      "Dedicated support",
      "Custom integrations",
      "SLA guarantee",
    ],
    cta: "Contact us",
    ctaHref: "mailto:hello@txid.support?subject=Enterprise enquiry",
    highlight: false,
  },
]

export default async function UpgradePage() {
  const { project } = await getProject()
  if (!project) redirect("/dashboard")

  const config = (project as unknown as { config: ProjectConfig }).config as ProjectConfig
  const currentPlan: Plan = config.plan ?? "free"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Upgrade your plan</h1>
        <p className="text-muted-foreground mt-1">
          Choose the plan that fits your protocol. Email us to upgrade — Stripe billing coming soon.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan
          return (
            <div
              key={plan.id}
              className={cn(
                "relative flex flex-col rounded-xl border p-5 transition-all",
                plan.highlight
                  ? "border-primary bg-primary/5"
                  : "border-border bg-[var(--bg-surface)]",
                isCurrent && "ring-1 ring-primary"
              )}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground">
                    Most popular
                  </span>
                </div>
              )}
              {isCurrent && (
                <div className="absolute -top-3 right-4">
                  <span className="rounded-full border border-border bg-background px-3 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    Current
                  </span>
                </div>
              )}

              <div className="mb-4">
                <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  {plan.label}
                </p>
                <p className="mt-1 text-2xl font-bold">{plan.price}</p>
                <p className="text-xs text-muted-foreground">{plan.priceSub}</p>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className="size-4 shrink-0 text-primary mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>

              {isCurrent ? (
                <div className="mt-auto rounded-lg border border-border px-4 py-2 text-center text-sm text-muted-foreground">
                  Current plan
                </div>
              ) : (
                <a
                  href={plan.ctaHref}
                  className={cn(
                    "mt-auto flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                    plan.highlight
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "border border-border hover:border-primary/50 hover:bg-accent/30"
                  )}
                >
                  {plan.highlight && <Zap className="size-3.5" />}
                  {plan.cta}
                </a>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Questions?{" "}
        <a href="mailto:hello@txid.support" className="underline underline-offset-2 hover:text-foreground transition-colors">
          Email us
        </a>{" "}
        — no long-term contracts, cancel anytime.
      </p>

      <div className="flex justify-center">
        <Link href="/dashboard/account" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to account
        </Link>
      </div>
    </div>
  )
}
