import Link from "next/link"
import { Code2, MessageSquare, LayoutDashboard, ArrowRight } from "lucide-react"

/**
 * The three ways a team consumes the resolution layer.
 *
 * This section exists because the site described ONE product, the embedded
 * agent, while the company sells three things built on one engine. A reader
 * who had been told about the API or the console found no trace of either,
 * which made the pitch and the site disagree.
 *
 * Status is stated per product rather than implied. A roadmap item presented
 * in the same voice as a live one is the kind of thing a technical buyer
 * checks and remembers.
 */
const PRODUCTS = [
  {
    name: "TxID Resolve",
    href: "/resolve",
    icon: Code2,
    status: "available" as const,
    line: "Put the answer in your own interface.",
    body: "One call returns what happened, whether funds moved, who acts next, and the evidence behind it. Wire it into your user journeys, your error screens, or a support bot you already run.",
    forWho: "For developers",
  },
  {
    name: "TxID Support",
    href: "/support",
    icon: MessageSquare,
    status: "available" as const,
    line: "Answer the user where they already are.",
    body: "An assistant embedded in your product that reads your documentation, your contracts and the live chain, and records the conditions behind every answer it gives.",
    forWho: "For product teams",
  },
  {
    name: "TxID Console",
    href: "/console",
    icon: LayoutDashboard,
    status: "development" as const,
    line: "Give your support team the chain.",
    body: "A console for managing failed transactions, connected to the CRM your team already works in, so an on-chain question stops being the one nobody can answer.",
    forWho: "For support teams",
  },
]

const STATUS_LABEL = {
  available: "Available now",
  development: "In development",
} as const

export function ProductTrio() {
  return (
    <section className="py-20 border-t border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-12">
          <p className="font-mono text-xs uppercase tracking-wider text-accent mb-3">
            One engine, three ways in
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
            However your users reach you, the answer is the same
          </h2>
          <p className="text-muted leading-relaxed">
            Every product below renders the same resolution: one diagnosis, one standard, one record. A question answered in your app and the same question answered by your support team do not produce two different stories.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5">
          {PRODUCTS.map(({ name, href, icon: Icon, status, line, body, forWho }) => (
            <Link
              key={name}
              href={href}
              className="group relative flex flex-col rounded-xl border border-[var(--border)] bg-surface p-6 transition-colors hover:border-[var(--border-accent)]"
            >
              <div className="flex items-center justify-between mb-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent-muted">
                  <Icon className="h-5 w-5 text-accent" />
                </span>
                <span
                  className={[
                    "font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded",
                    status === "available"
                      ? "text-teal bg-[color-mix(in_srgb,var(--teal)_12%,transparent)]"
                      : "text-muted bg-[var(--bg-elevated)]",
                  ].join(" ")}
                >
                  {STATUS_LABEL[status]}
                </span>
              </div>

              <h3 className="font-display text-xl font-bold text-white mb-1.5">{name}</h3>
              <p className="text-sm text-accent mb-3">{line}</p>
              <p className="text-sm text-muted leading-relaxed mb-5 flex-1">{body}</p>

              <div className="pt-4 border-t border-[var(--border)]">
                <p className="text-xs text-subtle mb-2">{forWho}</p>
                <span className="inline-flex items-center gap-1.5 text-sm text-white group-hover:text-accent transition-colors">
                  {status === "available" ? "See how it works" : "Talk to us about it"}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
