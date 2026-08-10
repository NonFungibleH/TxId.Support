"use client"

import { useState } from "react"
import { FindingList, type Finding } from "@/components/dashboard/FindingList"
import { cn } from "@/lib/utils"

/**
 * Bugs and feedback, side by side but never mixed.
 *
 * BUGS FIRST, because they are the ones with work attached. Feedback is
 * ambient and read in a batch; a bug is a thing someone has to decide about,
 * and putting it second teaches the team to scroll past it.
 *
 * Both stay out of Tickets. A tester reporting a bug is not waiting for a
 * reply any more than one leaving an opinion is, and a support queue that
 * fills with either stops being a queue.
 */
export function TesterReports({ bugs, feedback }: { bugs: Finding[]; feedback: Finding[] }) {
  const [tab, setTab] = useState<"bugs" | "feedback">(bugs.length > 0 ? "bugs" : "feedback")

  const tabs = [
    { id: "bugs" as const, label: "Bugs", count: bugs.length },
    { id: "feedback" as const, label: "Feedback", count: feedback.length },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === t.id
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "bugs" ? (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Things a tester found broken. Each one arrives with the page they were on, their wallet
            and chain, and the chain state at that moment, so nobody had to ask them for any of it.
            Open one to read the exchange that produced it.
          </p>
          <FindingList
            findings={bugs}
            emptyHint="These appear as soon as a tester picks Bug in the widget."
          />
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Opinions, suggestions and reactions, recorded rather than argued with. The assistant is
            told not to explain or defend when someone leaves one, and never to promise a reply.
          </p>
          <FindingList
            findings={feedback}
            emptyHint="These appear as soon as a tester picks Feedback in the widget."
          />
        </div>
      )}
    </div>
  )
}
