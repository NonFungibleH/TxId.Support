import Link from "next/link"
import { CUSTOMERS } from "@/lib/console/fixtures"

/**
 * The customer list, shown BY DEFAULT with search as a filter on top.
 *
 * The previous design was blank until you searched, which is a lookup tool,
 * not a CRM: a support person expects to see who exists and narrow from
 * there, the way every system they already use works.
 */
export function CustomerDirectory({ base, q }: { base: string; q?: string }) {
  const query = (q ?? "").trim().toLowerCase()
  const customers = query
    ? CUSTOMERS.filter(
        c =>
          c.label.toLowerCase().includes(query) ||
          c.email.toLowerCase().includes(query) ||
          c.wallet.toLowerCase().includes(query) ||
          c.id.toLowerCase() === query,
      )
    : CUSTOMERS

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone who has interacted with your contracts.
        </p>
      </div>

      <form action={`${base}/customers`} method="get">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Filter by name, email, or wallet"
          aria-label="Filter customers"
          className="w-full max-w-md rounded-lg border bg-card px-3.5 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
      </form>

      {customers.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          Nothing matches <span className="font-mono">{q}</span>. Try an email, a name, or a wallet address.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {customers.map(c => {
            const open = c.interactions.filter(i => i.outcome !== "succeeded").length
            return (
              <li key={c.id}>
                <Link
                  href={`${base}/customers/${c.id}`}
                  className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3 transition-colors hover:border-primary/40"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{c.label}</span>
                    <span className="block text-xs text-muted-foreground">{c.email} · {c.chain}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {open > 0
                      ? <span className="text-amber-600 dark:text-amber-400">{open} open</span>
                      : "No open cases"}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
