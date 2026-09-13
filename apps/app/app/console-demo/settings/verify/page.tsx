import { notFound } from "next/navigation"
import Link from "next/link"
import { ConsoleWorkspace } from "@/components/console/ConsoleWorkspace"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

/**
 * The verify step on fixtures. The authenticated page runs a live lookup, which
 * the demo cannot, so this one keeps the fixture workspace the design was
 * reviewed on. Same copy around it; only the search differs.
 */
export default function DemoVerify() {
  if (process.env.VERCEL_ENV === "production") notFound()
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
        </CardContent>
      </Card>
      <ConsoleWorkspace />
      <div className="flex items-center gap-3 border-t pt-4">
        <Link href="/console-demo" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          That looks right, finish setup <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
