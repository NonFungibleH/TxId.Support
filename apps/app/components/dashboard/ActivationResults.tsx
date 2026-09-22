import type { CohortSummary, ArmStats } from "@/lib/activation/cohort"
import { ACTIVATION_WINDOW_DAYS, MIN_KNOWN_PER_ARM } from "@/lib/activation/cohort"

/**
 * What the readiness check has done, and how sure we are.
 *
 * NO PERCENTAGE UNTIL IT MEANS SOMETHING. Below MIN_KNOWN_PER_ARM known
 * outcomes in either group the page shows counts and says it is too early,
 * out loud, the same rule the pilot insights follow. And the comparison is
 * stated with its interval, so "12 points more" arrives with how wide the
 * uncertainty around it is, rather than as a headline to repeat.
 */

function pct(n: number | null): string {
  return n === null ? "Too early" : `${(n * 100).toFixed(1)}%`
}

function signed(n: number): string {
  return `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`
}

function Arm({ title, s, note }: { title: string; s: ArmStats; note: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{pct(s.rate)}</p>
      <p className="text-xs text-muted-foreground">reached a first successful action</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs tabular-nums">
        <dt className="text-muted-foreground">New wallets</dt><dd className="text-right">{s.wallets}</dd>
        <dt className="text-muted-foreground">Activated</dt><dd className="text-right">{s.activated}</dd>
        <dt className="text-muted-foreground">Did not, in {ACTIVATION_WINDOW_DAYS} days</dt><dd className="text-right">{s.notActivated}</dd>
        <dt className="text-muted-foreground">Still in their window</dt><dd className="text-right">{s.inProgress}</dd>
        {s.unconfirmed > 0 && (<><dt className="text-muted-foreground">Could not confirm</dt><dd className="text-right">{s.unconfirmed}</dd></>)}
      </dl>
      <p className="mt-3 text-[11px] text-muted-foreground">{note}</p>
    </div>
  )
}

export function ActivationResults({ summary, holdoutPct }: { summary: CohortSummary | null; holdoutPct: number }) {
  if (!summary) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="font-semibold">Results</p>
        <p className="mt-1 text-sm text-muted-foreground">Results could not be loaded just now. The check itself keeps working for your users.</p>
      </div>
    )
  }

  const { shown, holdout, difference, excluded, funnel } = summary
  const total = shown.wallets + holdout.wallets

  let verdict: string
  if (!difference) {
    verdict = holdoutPct === 0 && holdout.wallets === 0
      ? "There is no comparison group, so there is nothing to compare against."
      : `Too early to compare. Each group needs ${MIN_KNOWN_PER_ARM} new wallets whose outcome is known.`
  } else if (difference.low > 0) {
    verdict = `${signed(difference.points)} points with the check. The 95% range is ${signed(difference.low)} to ${signed(difference.high)}, all above zero, so the difference is clear.`
  } else if (difference.high < 0) {
    verdict = `${signed(difference.points)} points with the check. The 95% range is ${signed(difference.low)} to ${signed(difference.high)}: fewer wallets activated with it.`
  } else {
    verdict = `${signed(difference.points)} points with the check, but the 95% range (${signed(difference.low)} to ${signed(difference.high)}) includes zero. No clear difference yet.`
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="font-semibold">Results</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          A first action is the wallet&apos;s first successful transaction to one of your watched contracts within {ACTIVATION_WINDOW_DAYS} days of first being seen, read from the chain.
        </p>
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">No new wallets yet. Results appear here as new wallets connect.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Arm title="With the check" s={shown} note={`Prompted ${funnel.prompted}, opened ${funnel.opened}, dismissed ${funnel.dismissed}.`} />
            <Arm title="Without it" s={holdout} note={`The ${holdoutPct}% comparison group. Their widget is otherwise unchanged.`} />
          </div>
          <p className="text-sm">{verdict}</p>
        </>
      )}

      {(excluded.existing > 0 || excluded.pending > 0) && (
        <p className="text-xs text-muted-foreground">
          Not counted: {excluded.existing} wallet{excluded.existing === 1 ? "" : "s"} that had already used your contracts when first seen
          {excluded.pending > 0 && <>, and {excluded.pending} whose history was too long to read in full, so whether they were new could not be proven</>}.
          Leaving the second group out tilts the count toward lighter wallets.
        </p>
      )}
    </div>
  )
}
