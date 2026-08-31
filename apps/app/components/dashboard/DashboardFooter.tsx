"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Moon, Sun, ShieldCheck, Zap } from "lucide-react"
import dynamic from "next/dynamic"

// Loaded only when it is actually rendered, which is admins only. A top-level
// import pulls Clerk's client bundle into every footer, and if Clerk cannot
// initialise (wrong domain for the key, for instance) that import takes the
// whole page down for people who were never going to see the control.
const OrganizationSwitcher = dynamic(
  () => import("@clerk/nextjs").then(m => m.OrganizationSwitcher),
  { ssr: false },
)
import { cn } from "@/lib/utils"

const PLAN_BADGE: Record<string, { label: string; cls: string }> = {
  free: { label: "Free", cls: "bg-muted text-muted-foreground" },
  starter: { label: "Starter", cls: "bg-muted text-muted-foreground" },
  pro: { label: "Pro", cls: "bg-primary/15 text-primary" },
  enterprise: { label: "Enterprise", cls: "bg-primary/15 text-primary" },
  custom: { label: "Custom", cls: "bg-primary/15 text-primary" },
  demo: { label: "Demo", cls: "bg-primary/15 text-primary" },
}

/**
 * The dashboard's bottom bar: which company you are in, on the left, and the
 * theme switch on the right.
 *
 * WHY IT LEFT THE SIDEBAR: the sidebar's lower block had become a second,
 * competing menu. It held the company switcher, the plan badge, the admin
 * link and the theme toggle stacked under a divider, so the eye had to
 * resolve two lists to answer "where am I" and "where do I go". These are
 * account-level controls, not navigation, and a bar across the bottom is
 * where an application puts that.
 *
 * FIXED, not sticky: the bar must stay put on a long Conversations page, and
 * it spans the full width INCLUDING under the sidebar, which is why the
 * sidebar and main content both reserve room for it rather than the bar
 * offsetting itself.
 */
export function DashboardFooter({
  plan = "free",
  isAdmin = false,
  orgName = "",
  webUrl,
}: {
  plan?: string
  isAdmin?: boolean
  orgName?: string
  webUrl: string
}) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const badge = PLAN_BADGE[plan] ?? PLAN_BADGE.free
  const showUpgrade = plan === "free" || plan === "starter"

  return (
    <footer className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background">
      <div className="flex h-12 items-center gap-3 px-3 md:px-4">
        {/* WHICH COMPANY AM I IN. Everything server-side was already org-aware
            (getProject keys on Clerk's orgId, invites go through the org APIs,
            roles live in org_members) but nothing in the interface could create
            or switch an organisation. This is the door.

            A new organisation has no project, so /dashboard sends it to
            /onboarding, which is why afterCreateOrganizationUrl points there:
            create the company, then create its project. */}
        {/* OPERATOR-ONLY. A customer's own team member must NOT see the switcher:
            it lets them jump to their personal account (which has no project and
            traps them on /onboarding) or "Create organization" (a self-serve
            project that bypasses the beta gate). Only a platform operator
            (ADMIN_EMAILS) manages organisations. Members just see their company
            name. */}
        {isAdmin ? (
          <OrganizationSwitcher
            afterCreateOrganizationUrl="/onboarding"
            afterSelectOrganizationUrl="/dashboard"
            afterSelectPersonalUrl="/dashboard"
            afterLeaveOrganizationUrl="/dashboard"
            appearance={{
              elements: {
                // text-foreground on BOTH: Clerk ships its own light-theme text
                // colour, which rendered the company name dark-on-dark the moment
                // night mode was on. Inheriting our token makes it track the theme.
                organizationSwitcherTrigger:
                  "rounded-md px-2 py-1 text-xs text-foreground hover:bg-accent/50",
                organizationPreviewMainIdentifier: "text-foreground text-xs",
              },
            }}
          />
        ) : (
          <span className="px-2 py-1 text-xs font-medium text-foreground">{orgName}</span>
        )}

        {isAdmin && (
          <Link
            href="/admin"
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors",
              (pathname ?? "").startsWith("/admin")
                ? "bg-primary/10 text-primary font-semibold"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <ShieldCheck className="size-3.5 shrink-0" />
            Admin console
          </Link>
        )}

        {/* Plan badge follows the company it belongs to. HIDDEN on the demo
            plan: demo is hand-provisioned for our own and early accounts, so
            the label is internal bookkeeping rather than information. */}
        {plan !== "demo" && (
          <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", badge.cls)}>
              {badge.label}
            </span>
            {showUpgrade && (
              <Link
                href="/dashboard/upgrade"
                className="flex items-center gap-1 text-[11px] font-medium text-primary transition-colors hover:text-primary/80"
              >
                <Zap className="size-3" />
                Upgrade
              </Link>
            )}
          </div>
        )}

        {/* Legal and help links sit in the middle, where they stay reachable
            without competing with either end of the bar. */}
        <div className="ml-auto hidden items-center gap-x-2.5 text-xs text-muted-foreground lg:flex">
          <a href={`${webUrl}/docs`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">Docs</a>
          <span className="opacity-40">·</span>
          <a href={`${webUrl}/terms`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">Terms</a>
          <span className="opacity-40">·</span>
          <a href={`${webUrl}/privacy`} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-foreground">Privacy</a>
          <span className="opacity-40">·</span>
          <a href="mailto:team@txid.support" className="transition-colors hover:text-foreground">Contact</a>
        </div>

        <button
          type="button"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground lg:ml-0"
        >
          {resolvedTheme === "dark"
            ? <><Sun className="size-3.5 shrink-0" /> Light mode</>
            : <><Moon className="size-3.5 shrink-0" /> Dark mode</>
          }
        </button>
      </div>
    </footer>
  )
}
