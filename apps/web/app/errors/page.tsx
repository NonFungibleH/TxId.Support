import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { FadeIn } from "@/components/ui/FadeIn"
import { errorsByCategory, TX_ERRORS } from "@/lib/errors"
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

          <FadeIn delay={0.08}>
            <div className="mt-8 rounded-xl border border-accent/30 bg-accent/5 p-5 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm text-white">
                Have a failed transaction right now? Skip the list: paste the hash and get the decoded reason.
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
            <FadeIn key={group.key} delay={0.1 + gi * 0.05}>
              <section className="mt-12">
                <h2 className="font-display text-2xl font-bold text-white mb-1">{group.label}</h2>
                <p className="text-sm text-muted mb-5">{group.blurb}</p>
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
