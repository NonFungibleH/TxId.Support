import type { Metadata } from "next"
import Link from "next/link"
import { ConsoleWorkspace } from "@/components/console/ConsoleWorkspace"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = { title: "Check it works | TxID Console" }
export const dynamic = "force-dynamic"

/**
 * The Console's equivalent of the support product's Preview: prove it works on
 * one real customer before a team starts depending on it.
 *
 * Deliberately the SAME workspace an agent uses rather than a special test
 * harness. A preview that behaves differently from the product proves nothing,
 * and this way the last setup step doubles as the tutorial.
 */
export default function VerifyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Check it works</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Look up one customer you already know about and confirm the answer matches what really happened.
        </p>
      </div>

      <Card className="border-primary/30">
        <CardContent className="pt-6">
          <p className="text-sm">Three things worth confirming:</p>
          <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
            <li>· Searching their email finds them, not just their wallet address.</li>
            <li>· Their activity shows what you expect, and nothing from outside your contracts.</li>
            <li>· A failure you already understand is described the way you would describe it.</li>
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            If the third one reads wrong, tell us before your team sees it. That is what this step is for.
          </p>
        </CardContent>
      </Card>

      <ConsoleWorkspace />

      <div className="flex items-center gap-3 border-t pt-4">
        <Link href="/console" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          That looks right, finish setup <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
