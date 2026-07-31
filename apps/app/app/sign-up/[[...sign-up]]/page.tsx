import Link from "next/link";

// Sign-ups are PAUSED while early deployments are hand-onboarded. Flip this
// to true to restore the Clerk <SignUp /> flow (import it back from
// "@clerk/nextjs"; the Web3-wallet options were hidden via appearance,
// see git history). Existing accounts keep signing in as normal.
const SIGNUPS_OPEN = false;

export default function SignUpPage() {
  if (!SIGNUPS_OPEN) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-4">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">TxID Support</p>
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

  return null;
}
