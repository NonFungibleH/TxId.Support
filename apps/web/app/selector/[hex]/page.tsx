import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { SELECTORS, getSelector } from "@/lib/selectors"
import { breadcrumbSchema, SITE_URL } from "@/lib/seo"
import { ArrowLeft, ArrowRight } from "lucide-react"

export async function generateStaticParams() {
  return SELECTORS.map((s) => ({ hex: s.selector }))
}

export async function generateMetadata({
  params,
}: {
  params: { hex: string }
}): Promise<Metadata> {
  const sel = getSelector(params.hex)
  if (!sel) return {}
  const title = `${sel.selector}: custom error ${sel.name} explained`
  return {
    title: `${title} | TxID`,
    description: `The selector ${sel.selector} matches ${sel.signature} (${sel.source}). ${sel.meaning.split(". ")[0]}. What it means and how to fix it.`,
    alternates: { canonical: `/selector/${sel.selector}` },
    openGraph: {
      title,
      description: sel.meaning,
      type: "article",
      url: `/selector/${sel.selector}`,
    },
  }
}

export default function SelectorPage({ params }: { params: { hex: string } }) {
  const sel = getSelector(params.hex)
  if (!sel) notFound()

  const related = SELECTORS.filter((s) => s.source === sel.source && s.selector !== sel.selector).slice(0, 4)

  const url = `${SITE_URL}/selector/${sel.selector}`
  const definedTerm = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: `${sel.selector} (${sel.name})`,
    alternateName: [sel.signature, sel.name],
    description: sel.meaning,
    url,
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Custom error selector reference",
      url: `${SITE_URL}/selector`,
    },
  }
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What does the error selector ${sel.selector} mean?`,
        acceptedAnswer: {
          "@type": "Answer",
          text: `${sel.selector} matches the custom error ${sel.signature}, defined in ${sel.source}. ${sel.meaning}`,
        },
      },
      {
        "@type": "Question",
        name: `How do I fix a transaction reverting with ${sel.selector}?`,
        acceptedAnswer: { "@type": "Answer", text: sel.fix },
      },
    ],
  }
  const breadcrumb = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Selector lookup", url: "/selector" },
    { name: sel.selector, url: `/selector/${sel.selector}` },
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(definedTerm) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <Navbar />
      <main className="min-h-screen pt-28 pb-24">
        <div className="max-w-2xl mx-auto px-6">
          <Link
            href="/selector"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors mb-10"
          >
            <ArrowLeft className="size-3.5" />
            All selectors
          </Link>

          <header className="mb-10">
            <p className="font-mono text-xs text-accent uppercase tracking-wider mb-3">{sel.source}</p>
            <h1 className="font-display text-3xl font-bold text-white leading-tight mb-4">
              <span className="font-mono">{sel.selector}</span>: {sel.name}
            </h1>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] px-4 py-3 overflow-x-auto">
              <code className="font-mono text-sm text-accent whitespace-nowrap">error {sel.signature}</code>
            </div>
          </header>

          <hr className="border-[var(--border)] mb-10" />

          <article>
            <h2 className="font-display text-2xl font-bold text-white mb-4">What it means</h2>
            <p className="text-[var(--text-muted)] leading-relaxed mb-4 text-base">
              A transaction that reverts with the raw data{" "}
              <code className="font-mono text-accent">{sel.selector}</code> hit the custom error{" "}
              <code className="font-mono">{sel.name}</code>, defined in {sel.source}. The explorer shows the
              hex because it does not have the contract&apos;s ABI to translate it.
            </p>
            <p className="text-[var(--text-muted)] leading-relaxed mb-10 text-base">{sel.meaning}</p>

            <h2 className="font-display text-2xl font-bold text-white mb-4">How to fix it</h2>
            <p className="text-[var(--text-muted)] leading-relaxed mb-10 text-base">{sel.fix}</p>
          </article>

          <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
            <p className="font-display font-semibold text-white mb-2">Want the exact answer for your transaction?</p>
            <p className="text-sm text-muted mb-5">
              Paste the hash and we decode the revert against the contract itself, including the values inside
              the error, free.
            </p>
            <Link
              href="/tx"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Decode my transaction
              <ArrowRight className="size-4" />
            </Link>
          </div>

          {related.length > 0 && (
            <div className="mt-12">
              <p className="font-mono text-xs text-muted uppercase tracking-wider mb-4">
                More {sel.source} errors
              </p>
              <div className="flex flex-col gap-2">
                {related.map((r) => (
                  <Link
                    key={r.selector}
                    href={`/selector/${r.selector}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-accent)] transition-colors"
                  >
                    <div className="flex items-baseline gap-3 min-w-0">
                      <code className="font-mono text-sm text-accent shrink-0">{r.selector}</code>
                      <span className="font-mono text-sm text-white truncate group-hover:text-accent transition-colors">
                        {r.name}
                      </span>
                    </div>
                    <ArrowRight className="size-4 text-muted shrink-0 group-hover:text-accent transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="mt-10 text-sm text-muted">
            Every selector on this page was computed as the first 4 bytes of keccak256 of the signature shown.
            A selector identifies a signature exactly; on rare occasions two different signatures share one, so
            the transaction decoder is always the more precise answer.
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
