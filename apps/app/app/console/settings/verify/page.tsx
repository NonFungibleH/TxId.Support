import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"
import { getProject } from "@/lib/actions/project"
import { resolveSearchTarget } from "@/lib/console/data"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight, Search } from "lucide-react"

export const metadata: Metadata = { title: "Check it works | TxID Console" }
export const dynamic = "force-dynamic"

/**
 * The Console's equivalent of the support product's Preview: prove it works on
 * one real customer before a team starts depending on it.
 *
 * Deliberately the SAME lookup an agent uses rather than a special harness. A
 * preview that behaves differently from the product proves nothing, so this
 * page is the global search with instructions around it, and a hit lands on
 * the same customer page the inbox would.
 */
export default async function VerifyPage({ searchParams }: { searchParams?: { q?: string } }) {
  const { project } = await getProject()
  if (!project) redirect("/onboarding")
  const q = searchParams?.q?.trim()
  let missed: string | null = null
  if (q) {
    const target = await resolveSearchTarget((project as { id: string }).id, q)
    if (target) redirect(`/console${target}`)
    missed = q
  }

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

      <form method="get" className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search an email, wallet address, or transaction hash"
          aria-label="Find a customer"
          className="w-full rounded-xl border border-border bg-card py-3.5 pl-11 pr-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
      </form>

      {missed && (
        <p className="text-sm text-muted-foreground">
          Nothing found for <span className="font-mono text-foreground">{missed}</span>. An email only resolves once that customer has been mapped to a wallet; a hash only resolves once it has been diagnosed.
        </p>
      )}

      <div className="flex items-center gap-3 border-t pt-4">
        <Link href="/console" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          That looks right, finish setup <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  )
}
