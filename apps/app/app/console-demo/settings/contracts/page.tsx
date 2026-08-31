import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { FileCode2 } from "lucide-react"

export const dynamic = "force-dynamic"

/**
 * The real page re-exports the support product's Smart Contracts page, which
 * reads the project from the session and so cannot render unauthenticated.
 * Saying that is better than a blank page: the shared page IS the point.
 */
export default function DemoContractsPage() {
  if (process.env.VERCEL_ENV === "production") notFound()
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Smart Contracts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Which contracts are yours. Everything the Console shows is scoped to these.
        </p>
      </div>
      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 pt-6">
          <FileCode2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm">This is the same Smart Contracts page the support product uses.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Contracts are project-level configuration shared by every product, so a customer with Support and Console
              declares them once and the two lists cannot disagree. It reads your project from the session, so it needs
              a signed-in workspace rather than this review copy.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
