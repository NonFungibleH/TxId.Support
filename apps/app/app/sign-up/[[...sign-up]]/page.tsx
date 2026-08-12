import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

// TEMPORARILY OPEN (2026-08-12) so the Yamata pilot team can accept their
// invites: Clerk's invitation email lands invitees on /sign-in without the
// ticket (a Dashboard "Paths" setting we still need to fix), so the ticket
// bypass on this page never fired. With sign-ups open, an invitee signs up with
// their invited email and Clerk auto-joins them to the org. FLIP BACK TO false
// once the team is onboarded and the Clerk sign-up URL is configured.
const SIGNUPS_OPEN = true;

/**
 * AN INVITATION IS NOT A PUBLIC SIGN-UP, and this page could not tell them
 * apart. Clerk sends an invited colleague here with a `__clerk_ticket` in the
 * query, which is a signed, single-use, already-paid-for admission. The gate
 * swallowed it and showed "Free plan coming soon", so the invite went nowhere:
 * they bounced to sign-in, where they had no account, and got "Couldn't find
 * your account". Reproduced end to end before the client's team was invited.
 *
 * So the gate now applies only to people arriving WITHOUT a ticket. With one,
 * Clerk's own <SignUp /> renders and consumes it, which is the flow that
 * creates the account and adds them to the organisation in one step.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const hasInvitation = typeof params.__clerk_ticket === "string" && params.__clerk_ticket.length > 0;

  if (hasInvitation || SIGNUPS_OPEN) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <SignUp />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">TxID</p>
        <h1 className="text-2xl font-bold">Free plan coming soon</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We&apos;re onboarding early teams by hand while we scale up. Tell us about
          your protocol and we&apos;ll set you up personally.
        </p>
        <a
          href="mailto:team@txid.support?subject=TxID early access"
          className="inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Request early access
        </a>
        <p className="text-xs text-muted-foreground">
          Already have an account? <Link href="/sign-in" className="underline hover:text-foreground">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
