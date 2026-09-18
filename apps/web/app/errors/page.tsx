import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { FadeIn } from "@/components/ui/FadeIn"
import { errorsByCategory, TX_ERRORS, type TxError } from "@/lib/errors"
import { VISIBLE_CHAINS } from "@/lib/chains"
import { breadcrumbSchema } from "@/lib/seo"
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "Transaction error reference: every failure message explained | TxID",
  description:
    "A plain-English reference to every transaction error message: gas errors, nonce problems, contract reverts, Solidity panics and wallet warnings, each with what it means and how to fix it.",
  alternates: { canonical: "/errors" },
  openGraph: {
    title: "Transaction error reference: every failure message explained",
    description:
      "Every transaction error message explained: what it means and how to fix it, from intrinsic gas too low to execution reverted.",
    type: "website",
    url: "/errors",
  },
}

function chainName(slug: string): string {
  return VISIBLE_CHAINS.find(c => c.slug === slug)?.name ?? slug
}

/** Group the generated entries by chain, keeping the order they arrive in. */
function byChain(errors: TxError[]): { chain: string; errors: TxError[] }[] {
  const out: { chain: string; errors: TxError[] }[] = []
  for (const e of errors) {
    const chain = e.chain ?? "other"
    const last = out.find(g => g.chain === chain)
    if (last) last.errors.push(e)
    else out.push({ chain, errors: [e] })
  }
  return out
}

function errorRow(e: TxError) {
  return (
    <Link
      key={e.slug}
      href={`/errors/${e.slug}`}
      className="group flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-accent)] transition-colors"
    >
      <div className="min-w-0">
        <p className="font-mono text-sm text-white group-hover:text-accent transition-colors">{e.message}</p>
        <p className="text-xs text-muted mt-1 line-clamp-1">{e.meaning}</p>
      </div>
      <ArrowRight className="size-4 text-muted shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
    </Link>
  )
}

export default function ErrorsIndexPage() {
  const groups = errorsByCategory()
  const breadcrumb = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Error reference", url: "/errors" },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <Navbar />
      <main className="min-h-screen pt-28 pb-24">
        <div className="max-w-3xl mx-auto px-6">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">Error reference</p>
            <h1 className="font-display text-4xl font-bold text-white mb-4">
              Every transaction error, explained
            </h1>
            <p className="text-muted text-base max-w-2xl">
              The exact messages wallets and block explorers show when a transaction fails, in plain
              English: what each one means, and how to fix it. {TX_ERRORS.length} errors and counting.
            </p>
          </FadeIn>

          {groups.map((group, gi) => (
            <FadeIn key={group.key} delay={0.1 + gi * 0.05}>
              <section className="mt-12">
                <h2 className="font-display text-2xl font-bold text-white mb-1">{group.label}</h2>
                <p className="text-sm text-muted mb-5">{group.blurb}</p>
                {group.key === "chain" ? (
                  // One heading per chain, each with an anchor, so a link can
                  // land on exactly one chain's codes (txid.support/errors#aptos)
                  // instead of a single list mixing six chains. Names come from
                  // the chain registry, not a list kept here.
                  byChain(group.errors).map(({ chain, errors }) => (
                    <div key={chain} id={chain} className="scroll-mt-28 mt-8 first:mt-0">
                      <h3 className="font-display text-lg font-semibold text-white mb-3">{chainName(chain)}</h3>
                      <div className="flex flex-col gap-2">{errors.map(errorRow)}</div>
                    </div>
                  ))
                ) : (
                <div className="flex flex-col gap-2">
                  {group.errors.map((e) => (
                    <Link
                      key={e.slug}
                      href={`/errors/${e.slug}`}
                      className="group flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-accent)] transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-white group-hover:text-accent transition-colors">
                          {e.message}
                        </p>
                        <p className="text-xs text-muted mt-1 line-clamp-1">{e.meaning}</p>
                      </div>
                      <ArrowRight className="size-4 text-muted shrink-0 mt-0.5 group-hover:text-accent transition-colors" />
                    </Link>
                  ))}
                </div>
                )}
              </section>
            </FadeIn>
          ))}

          <FadeIn delay={0.2}>
            <div className="mt-14 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 text-sm text-muted">
              <p>
                Seeing a raw hex code like{" "}
                <code className="font-mono text-accent">0x118cdaa7</code> instead of a message? That is a
                custom-error selector:{" "}
                <Link href="/selector" className="text-accent hover:underline">
                  look it up in the selector reference
                </Link>
                . For the full walkthrough of why transactions fail, read{" "}
                <Link href="/blog/transaction-error-messages-explained" className="text-accent hover:underline">
                  the error guide
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
