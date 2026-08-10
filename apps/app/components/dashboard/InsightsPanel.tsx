import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Layers, MonitorSmartphone, CircleDot, ShieldCheck } from "lucide-react"
import type { Insights } from "@/lib/insights"
import { OUTCOME_META, type Outcome } from "@/lib/conversation-outcome"
import { BASIS_LABEL, type TicketBasis } from "@/lib/ticket-signals"

/**
 * What the pilot produced, for the person deciding whether to keep paying.
 *
 * NO PERCENTAGES, ANYWHERE. Every figure here is a count, because a beta runs
 * on tens of conversations and a rate off a handful of them is a claim that
 * cannot be defended when questioned. `smallSample` says so out loud rather
 * than leaving the reader to work out that n was 11.
 *
 * NO WORD CLOUD. Themes are a ranked list: frequency as area reads badly, and
 * a cloud throws away the thing that makes support text worth reading, which is
 * what the person was trying to DO.
 *
 * Every section routes back to the conversations behind it. A number a reader
 * cannot open is a number they have to take on trust, which is exactly the
 * posture this product exists to argue against.
 */

/** Search rather than a row id, matching how the gaps panel already links. */
function conversationSearch(text: string): string {
  return `/dashboard/conversations?q=${encodeURIComponent(text.slice(0, 40))}`
}

/** Origin stripped, so a list of paths reads as a list of screens. */
function shortPath(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname === "/" ? u.hostname : u.pathname
  } catch {
    return url
  }
}

function hostOf(url: string): string | null {
  try { return new URL(url).hostname } catch { return null }
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

export function InsightsPanel({ insights }: { insights: Insights | null }) {
  if (!insights || insights.conversations === 0) return null

  const {
    days, conversations, smallSample, truncated,
    outcomes, basis, docGaps, themes, screens, screensUnknown,
  } = insights

  const notCovered = docGaps.filter(g => g.kind === "none").length
  const thin = docGaps.length - notCovered

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">Pilot insights</h2>
        <p className="text-xs text-muted-foreground">
          {conversations} conversation{conversations === 1 ? "" : "s"} in the last {days} days
          {truncated && ", most recent first"}
          {smallSample && ". Counts only: too few to express as rates."}
        </p>
      </div>

      {/* ── 1. Documentation gaps ──────────────────────────────────────────
          FIRST, because it is the only section that converts directly into
          somebody's task list. Questions, not summaries: a summary is our
          words about what happened, the question is the page to write. */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BookOpen className="size-4 text-muted-foreground" />
            What your documentation did not answer
          </CardTitle>
          <CardDescription className="text-xs">
            {docGaps.length === 0
              ? "Every question that reached a documentation search found something to answer from."
              : `${notCovered} question${notCovered === 1 ? "" : "s"} matched nothing at all${thin > 0 ? `, ${thin} matched only weakly` : ""}. In the tester's own words, newest first.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {docGaps.length === 0 ? (
            <Empty>Nothing to write. This is the good outcome.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {docGaps.map((g, i) => (
                <li key={`${g.conversationId}-${i}`}>
                  <Link
                    href={conversationSearch(g.question)}
                    className="flex items-start justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                  >
                    <span className="min-w-0 text-sm">{g.question}</span>
                    <span
                      className={
                        g.kind === "none"
                          ? "shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400"
                          : "shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
                      }
                      title={
                        g.kind === "none"
                          ? "The documentation search returned nothing for this question."
                          : `The best match scored ${g.topScore?.toFixed(2) ?? "low"}, close to the floor. Something matched, but not well enough to lean on.`
                      }
                    >
                      {g.kind === "none" ? "Not covered" : "Thin"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* ── 2. Themes ─────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Layers className="size-4 text-muted-foreground" />
              What testers kept coming back to
            </CardTitle>
            <CardDescription className="text-xs">
              Phrases that appear across more than one conversation, ranked. Their words, not ours.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {themes.length === 0 ? (
              <Empty>
                Nothing has come up more than once yet. Themes appear as testers repeat each other.
              </Empty>
            ) : (
              <ul className="space-y-2">
                {themes.map(t => (
                  <li key={t.phrase}>
                    <Link
                      href={conversationSearch(t.phrase)}
                      className="block rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-medium">{t.phrase}</span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {t.count}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        &ldquo;{t.example}&rdquo;
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ── 3. Findings by screen ─────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <MonitorSmartphone className="size-4 text-muted-foreground" />
              Where problems were found
            </CardTitle>
            <CardDescription className="text-xs">
              The page the tester was on when it happened, recorded at the time. Most support tools
              never know this.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {screens.length === 0 ? (
              <Empty>
                {screensUnknown > 0
                  ? `${screensUnknown} finding${screensUnknown === 1 ? "" : "s"} recorded, none with a page attached. The page is captured by the embed, so this fills in once the widget is installed on your site.`
                  : "No bugs or feedback recorded yet."}
              </Empty>
            ) : (
              <>
                <ul className="space-y-1">
                  {screens.map(s => (
                    <li
                      key={s.url}
                      className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5"
                    >
                      <span className="min-w-0 truncate font-mono text-xs" title={s.url}>
                        {shortPath(s.url)}
                        {hostOf(s.url) && (
                          <span className="ml-1.5 text-[10px] text-muted-foreground">
                            {hostOf(s.url)}
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 text-[10px]">
                        {s.bugs > 0 && (
                          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                            {s.bugs} bug{s.bugs === 1 ? "" : "s"}
                          </span>
                        )}
                        {s.feedback > 0 && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            {s.feedback} feedback
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
                {screensUnknown > 0 && (
                  <p className="mt-2 px-2 text-[10px] text-muted-foreground">
                    {screensUnknown} more with no page recorded, so this list is not the whole set.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── 4. Outcomes ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <CircleDot className="size-4 text-muted-foreground" />
              How conversations ended
            </CardTitle>
            <CardDescription className="text-xs">
              There is deliberately no &ldquo;resolved&rdquo;. Someone who got what they needed and
              closed the tab and someone who gave up look identical in the record.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {outcomes.map(o => (
                <li
                  key={o.outcome}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5"
                  title={OUTCOME_META[o.outcome as Outcome]?.title ?? "Answered, with nothing else to report."}
                >
                  <span className="text-sm">
                    {OUTCOME_META[o.outcome as Outcome]?.label ?? "Answered"}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{o.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── 5. Basis ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <ShieldCheck className="size-4 text-muted-foreground" />
              What answers rested on
            </CardTitle>
            <CardDescription className="text-xs">
              Taken as the worst case in each conversation, never an average: one unverifiable
              answer among good ones is exactly the one worth seeing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {basis.map(b => (
                <li
                  key={b.basis}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5"
                  title={BASIS_HELP[b.basis as TicketBasis]}
                >
                  <span className="flex items-center gap-2 text-sm">
                    <span className={`size-1.5 rounded-full ${BASIS_DOT[b.basis as TicketBasis]}`} />
                    {BASIS_LABEL[b.basis as TicketBasis]}
                  </span>
                  <span className="text-sm tabular-nums text-muted-foreground">{b.count}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

/** Said in full here, because this is the section a buyer reads hardest. */
const BASIS_HELP: Record<TicketBasis, string> = {
  verified: "A live read succeeded, so the answer rests on chain state we fetched and recorded.",
  documented: "Your documentation matched, but no live read was needed or possible.",
  unverified: "Neither a live read nor a documentation match. Answered from general knowledge, which is the one category nobody can check.",
  unknown: "No evidence was recorded, usually because the conversation predates evidence capture.",
}

const BASIS_DOT: Record<TicketBasis, string> = {
  verified: "bg-emerald-500",
  documented: "bg-sky-500",
  unverified: "bg-amber-500",
  unknown: "bg-muted-foreground/40",
}
