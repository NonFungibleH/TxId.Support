import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ThumbsDown, Ticket, CloudOff, HeartCrack, MessageSquareOff, BookX, TrendingUp } from "lucide-react"
import type { GapsReport, GapItem } from "@/lib/gaps"

function GapList({ items, empty }: { items: GapItem[]; empty: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{empty}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map(item => (
        <li key={item.conversationId}>
          <Link
            href={`/dashboard/conversations?q=${encodeURIComponent(item.summary.slice(0, 40))}`}
            className="block rounded-lg border border-border bg-muted/30 px-3 py-2 transition-colors hover:border-primary/50"
          >
            <p className="line-clamp-2 text-xs leading-relaxed">{item.summary}</p>
            {item.category && (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {item.category.replace(/-/g, " ")}
              </p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/**
 * Where the engine fell short, split by who owns the fix.
 *
 * A weak answer caused by missing documentation and one caused by a failed
 * chain read look identical in a transcript, but the first belongs to the
 * content owner and the second to whoever runs the infrastructure. Keeping
 * them apart is the difference between a list of complaints and a work queue.
 */
export function GapsPanel({ report, days }: { report: GapsReport; days: number }) {
  const { totals } = report
  const pct = totals.conversations > 0
    ? Math.round((totals.withProblems / totals.conversations) * 100)
    : 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Where it fell short</CardTitle>
        <p className="text-xs text-muted-foreground">
          {totals.withProblems} of {totals.conversations} conversations in the last {days} days
          needed attention ({pct}%). Never answered means no reply was generated at all,
          which is ours. Knowledge gaps are yours; data gaps are ours.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <MessageSquareOff className="size-3.5 text-red-600" />
              <p className="text-xs font-semibold">Never answered</p>
            </div>
            <GapList items={report.unanswered} empty="Every question got a reply." />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <ThumbsDown className="size-3.5 text-amber-600" />
              <p className="text-xs font-semibold">Marked unhelpful</p>
            </div>
            <GapList items={report.thumbsDown} empty="Nobody marked an answer unhelpful." />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Ticket className="size-3.5 text-primary" />
              <p className="text-xs font-semibold">Needed a human</p>
            </div>
            <GapList items={report.escalated} empty="Nothing was escalated." />
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <HeartCrack className="size-3.5 text-rose-600" />
              <p className="text-xs font-semibold">Left unhappy, said nothing</p>
            </div>
            <GapList
              items={report.silentlyUnhappy}
              empty="No negative conversations went unescalated."
            />
          </div>
        </div>

        {report.topics.length > 0 && (
          <div className="space-y-2.5 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-3.5 text-primary" />
              <p className="text-xs font-semibold">What they keep asking</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Ranked from users&apos; own words across the conversations above. This is the
              write-this-next list: the lists further up say what happened, this says what to do
              about it.
            </p>
            <ul className="space-y-1.5">
              {report.topics.map(t => (
                <li
                  key={t.phrase}
                  className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium capitalize">{t.phrase}</p>
                    <p className="line-clamp-1 text-[11px] text-muted-foreground">
                      e.g. &ldquo;{t.example}&rdquo;
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.docCoverage.answered > 0 && (
          <div className="space-y-2.5 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <BookX className="size-3.5 text-violet-600" />
              <p className="text-xs font-semibold">Documentation coverage</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Of {report.docCoverage.answered} answers that searched your documentation,{" "}
              <span className="font-medium text-foreground">{report.docCoverage.noMatch}</span> found
              nothing and{" "}
              <span className="font-medium text-foreground">{report.docCoverage.weakMatch}</span>{" "}
              found only a weak match. Those are pages to write and pages to sharpen, in that order.
              Each answer carried an average of{" "}
              <span className="font-medium text-foreground">
                {report.docCoverage.avgContextChars.toLocaleString()}
              </span>{" "}
              characters of documentation into the prompt, which you pay for on every message.
            </p>
            {report.docGaps.length > 0 && <GapList items={report.docGaps} empty="" />}
          </div>
        )}

        {report.dataGaps.length > 0 && (
          <div className="space-y-2.5 border-t border-border pt-5">
            <div className="flex items-center gap-2">
              <CloudOff className="size-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold">Data gaps, not knowledge gaps</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Reads that failed while answering. These are infrastructure, so adding documentation
              will not help.
            </p>
            <ul className="space-y-1.5">
              {report.dataGaps.map(gap => (
                <li
                  key={gap.reason}
                  className="flex items-baseline justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2"
                >
                  <span className="text-xs">{gap.reason}</span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {gap.count}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {report.byCategory.length > 0 && (
          <div className="space-y-2.5 border-t border-border pt-5">
            <p className="text-xs font-semibold">Which subjects they cluster in</p>
            <div className="flex flex-wrap gap-2">
              {report.byCategory.map(c => (
                <span
                  key={c.category}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs"
                >
                  {c.category.replace(/-/g, " ")}
                  <span className="ml-1.5 font-mono tabular-nums text-muted-foreground">{c.count}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
