import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle2, Circle, ArrowRight } from "lucide-react"
import type { SetupState } from "@/lib/console/setup"

/**
 * Where you are in setting the Console up.
 *
 * Shown until the required steps are done, then it disappears rather than
 * living permanently in the interface. A checklist that never goes away stops
 * being read, and the support product's own start card works the same way.
 */
export function SetupChecklist({ state }: { state: SetupState }) {
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Finish setting up the Console</CardTitle>
        <p className="text-sm text-muted-foreground">
          {state.requiredRemaining === 0
            ? "One optional step left."
            : `${state.requiredRemaining} step${state.requiredRemaining === 1 ? "" : "s"} to go before your team can use it.`}
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {state.steps.map(step => (
          <Link
            key={step.id}
            href={step.href}
            className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:border-primary/40"
          >
            {step.done ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className={`text-sm ${step.done ? "text-muted-foreground line-through" : ""}`}>
                  {step.label}
                </span>
                {step.optional && !step.done && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Optional</span>
                )}
              </span>
              {!step.done && <span className="mt-0.5 block text-xs text-muted-foreground">{step.why}</span>}
            </span>
            {!step.done && <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />}
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
