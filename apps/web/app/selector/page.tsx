import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { FadeIn } from "@/components/ui/FadeIn"
import { SELECTORS, selectorsBySource } from "@/lib/selectors"
import { breadcrumbSchema } from "@/lib/seo"
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "Custom error selector lookup: decode revert hex codes | TxID",
  description:
    "Look up the 4-byte hex selector a failed transaction shows (like 0x118cdaa7) and get the decoded error name, what it means, and how to fix it. OpenZeppelin, Uniswap and common DeFi errors.",
  alternates: { canonical: "/selector" },
  openGraph: {
    title: "Custom error selector lookup: decode revert hex codes",
    description:
      "Decode the raw hex selector a failed transaction shows into a named error with a plain-English meaning and fix.",
    type: "website",
    url: "/selector",
  },
}

export default function SelectorIndexPage() {
  const groups = selectorsBySource()
  const breadcrumb = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Selector lookup", url: "/selector" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <Navbar />
      <main className="min-h-screen pt-28 pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">Selector lookup</p>
            <h1 className="font-display text-4xl font-bold text-white mb-4">
              Decode the hex code your failed transaction shows
            </h1>
            <p className="text-muted text-base max-w-2xl">
              When a modern contract reverts with a custom error and the block explorer does not know the
              contract&apos;s ABI, all you see is a 4-byte hex selector like{" "}
              <code className="font-mono text-accent">0x118cdaa7</code>. This reference maps{" "}
              {SELECTORS.length} common selectors back to their named error, with what it means and the fix.
            </p>
          </FadeIn>

          <FadeIn delay={0.08}>
            <div className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-white">
                Selector not listed, or want the full story? Paste the transaction hash instead.
              </p>
              <Link
                href="/tx"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity shrink-0"
              >
                Decode a transaction
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </FadeIn>

          {groups.map((group, gi) => (
            <FadeIn key={group.source} delay={0.1 + gi * 0.05}>
              <section className="mt-12">
                <h2 className="font-display text-xl font-bold text-white mb-4">{group.source}</h2>
                <div className="flex flex-col gap-2">
                  {group.entries.map((s) => (
                    <Link
                      key={s.selector}
                      href={`/selector/${s.selector}`}
                      className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-accent)] transition-colors"
                    >
                      <div className="flex items-baseline gap-3 min-w-0">
                        <code className="font-mono text-sm text-accent shrink-0">{s.selector}</code>
                        <span className="font-mono text-sm text-white truncate group-hover:text-accent transition-colors">
                          {s.name}
                        </span>
                      </div>
                      <ArrowRight className="size-4 text-muted shrink-0 group-hover:text-accent transition-colors" />
                    </Link>
                  ))}
                </div>
              </section>
            </FadeIn>
          ))}

          <FadeIn delay={0.2}>
            <div className="mt-14 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 text-sm text-muted space-y-3">
              <p>
                <span className="text-white font-medium">How selectors work:</span> a custom error like{" "}
                <code className="font-mono">OwnableUnauthorizedAccount(address)</code> is identified on-chain
                by the first 4 bytes of the keccak256 hash of its signature. Every selector on this page was
                computed from its signature with that method. A selector identifies a signature exactly; in
                rare cases two different signatures can share the same 4 bytes, which is why pasting the full
                transaction into a decoder is always the more precise answer.
              </p>
              <p>
                Got a plain-English message instead of hex? See the{" "}
                <Link href="/errors" className="text-accent hover:underline">
                  transaction error reference
                </Link>
                .
              </p>
            </div>
          </FadeIn>
        </div>
      </main>
      <Footer />
    </>
  )
}
