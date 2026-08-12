import { getProject } from "@/lib/actions/project"
import { redirect } from "next/navigation"
import { OnboardingForm } from "@/components/onboarding/OnboardingForm"
import { isCurrentUserAdmin } from "@/lib/admin-auth"
import { OrganizationSwitcher, UserButton } from "@clerk/nextjs"

/**
 * Three outcomes, because sign-ups are open (so invited teammates can accept)
 * but TxID is still hand-onboarding teams:
 *
 * - A project already exists → straight to the dashboard. Covers a returning
 *   user AND an invited teammate who joined an org that already has one.
 * - No project + a platform operator → the create-project form. Operators are
 *   the ones who set up new customers.
 * - No project + anyone else → a holding screen. A stranger who signs up should
 *   be thanked and told we will be in touch, not handed a self-serve form.
 *
 * ESCAPE HATCH: a user who switches their active organisation to one with no
 * project (e.g. their personal account) is otherwise TRAPPED here, because every
 * dashboard route bounces back to /onboarding and this page has no navigation.
 * The org switcher lets them return to an organisation that has a project.
 */
export default async function OnboardingPage() {
  const { project } = await getProject()
  if (project) redirect("/dashboard")

  const isOperator = await isCurrentUserAdmin()

  return (
    <div className="min-h-screen">
      <div className="flex items-center justify-end gap-3 p-4">
        {/* Operator-only: the switcher lets an operator escape a wrong active
            org and manage companies. A regular member must not create or switch
            orgs, so they only get the sign-out control. */}
        {isOperator && <OrganizationSwitcher afterSelectOrganizationUrl="/dashboard" />}
        <UserButton />
      </div>

      {isOperator ? (
        <OnboardingForm />
      ) : (
        <div className="flex items-center justify-center px-6 pt-12">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">TxID</p>
            <h1 className="text-2xl font-bold">Thanks for signing up</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              TxID is in private beta and we&apos;re onboarding teams by hand right now.
              Your account is all set: we&apos;ll email you the moment we open it up.
            </p>
            <a
              href="mailto:team@txid.support?subject=TxID early access"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Tell us about your protocol
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
