import { currentUser } from "@clerk/nextjs/server"
import { notFound } from "next/navigation"
import { runEval } from "@/lib/eval"

export const dynamic = "force-dynamic"

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map(e => e.trim()).filter(Boolean)

export default async function EvalPage({
  searchParams,
}: {
  searchParams: Promise<{ tx?: string; chain?: string }>
}) {
  const user = await currentUser()
  const primaryEmail = user?.emailAddresses?.find(e => e.id === user.primaryEmailAddressId)?.emailAddress?.toLowerCase()
  if (!primaryEmail || (ADMIN_EMAILS.length > 0 && !ADMIN_EMAILS.includes(primaryEmail))) {
    return notFound()
  }

  const sp = await searchParams
  const result = await runEval(sp.tx && sp.chain ? { tx: sp.tx, txChain: sp.chain } : undefined)
  const allPass = result.failed === 0

  return (
    <div className="min-h-screen bg-background p-6 md:p-10 space-y-6">
      <div>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-mono mb-1">Internal — diagnostic eval</p>
        <h1 className="text-3xl font-bold">Bot capability eval</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Live checks of the on-chain tools against known-correct answers. Add <code className="font-mono text-xs bg-muted px-1 rounded">?tx=0x…&chain=0x1</code> to spot-check a real transaction.
        </p>
      </div>

      <div className={`rounded-xl border p-4 ${allPass ? "border-green-500/30 bg-green-500/5" : "border-red-500/30 bg-red-500/5"}`}>
        <p className="text-lg font-bold">
          {allPass ? "✅ All checks passed" : `⚠️ ${result.failed} of ${result.checks.length} failed`}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {result.passed} passed · {result.failed} failed · ran {result.ranAt}
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground w-16">Result</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Check</th>
              <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {result.checks.map(c => (
              <tr key={c.name} className="hover:bg-muted/20">
                <td className="px-4 py-3">
                  <span className={c.pass ? "text-green-400" : "text-red-400"}>{c.pass ? "PASS" : "FAIL"}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-[11px] break-all">{c.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
