import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { TX_ERRORS, ERROR_CATEGORIES, getError } from "@/lib/errors"
import { breadcrumbSchema, SITE_URL } from "@/lib/seo"
import { ArrowLeft, ArrowRight } from "lucide-react"

export async function generateStaticParams() {
  return TX_ERRORS.map((e) => ({ slug: e.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const err = getError(params.slug)
  if (!err) return {}
  const title = `"${err.message}": what it means and how to fix it`
  return {
    title: `${title} | TxID`,
    description: `${err.meaning.split(". ")[0]}. What the error means, why it happens, and the fix.`,
    alternates: { canonical: `/errors/${err.slug}` },
    openGraph: {
      title,
      description: err.meaning,
      type: "article",
      url: `/errors/${err.slug}`,
    },
  }
}

export default function ErrorPage({ params }: { params: { slug: string } }) {
  const err = getError(params.slug)
  if (!err) notFound()

  const category = ERROR_CATEGORIES[err.category]
  const related = TX_ERRORS.filter((e) => e.category === err.category && e.slug !== err.slug).slice(0, 4)

  const url = `${SITE_URL}/errors/${err.slug}`
  const definedTerm = {
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: err.message,
    description: err.meaning,
    url,
    ...(err.aka?.length ? { alternateName: err.aka } : {}),
    inDefinedTermSet: {
      "@type": "DefinedTermSet",
      name: "Transaction error reference",
      url: `${SITE_URL}/errors`,
    },
  }
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: `What does "${err.message}" mean?`,
        acceptedAnswer: { "@type": "Answer", text: err.meaning },
      },
      {
        "@type": "Question",
        name: `How do I fix "${err.message}"?`,
        acceptedAnswer: { "@type": "Answer", text: err.fix },
      },
    ],
  }
  const breadcrumb = breadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Error reference", url: "/errors" },
    { name: err.message, url: `/errors/${err.slug}` },
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
            href="/errors"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors mb-10"
          >
            <ArrowLeft className="size-3.5" />
            All errors
          </Link>

          <header className="mb-10">
            <p className="font-mono text-xs text-accent uppercase tracking-wider mb-3">{category.label}</p>
            <h1 className="font-display text-3xl font-bold text-white leading-tight mb-4">
              &ldquo;{err.message}&rdquo;
            </h1>
            {err.aka && err.aka.length > 0 && (
              <p className="text-sm text-muted">
                Also appears as:{" "}
                {err.aka.map((a, i) => (
                  <span key={a} className="font-mono text-muted/90">
                    &ldquo;{a}&rdquo;{i < err.aka!.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            )}
          </header>

          <hr className="border-[var(--border)] mb-10" />

          <article>
            <h2 className="font-display text-2xl font-bold text-white mb-4">What it means</h2>
            <p className="text-[var(--text-muted)] leading-relaxed mb-10 text-base">{err.meaning}</p>

            <h2 className="font-display text-2xl font-bold text-white mb-4">How to fix it</h2>
            <p className="text-[var(--text-muted)] leading-relaxed mb-10 text-base">{err.fix}</p>
          </article>

          <div className="rounded-xl border border-accent/30 bg-accent/5 p-6 text-center">
            <p className="font-display font-semibold text-white mb-2">Still stuck?</p>
            <p className="text-sm text-muted mb-5">
              Paste your transaction hash and get the exact decoded reason for your failure, free.
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
                More {category.label.toLowerCase()} errors
              </p>
              <div className="flex flex-col gap-2">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    href={`/errors/${r.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-accent)] transition-colors"
                  >
                    <p className="font-mono text-sm text-white group-hover:text-accent transition-colors">{r.message}</p>
                    <ArrowRight className="size-4 text-muted shrink-0 group-hover:text-accent transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p className="mt-10 text-sm text-muted">
            For the full walkthrough of why transactions fail, read{" "}
            <Link href="/blog/transaction-error-messages-explained" className="text-accent hover:underline">
              the complete error guide
            </Link>
            .
          </p>
        </div>
      </main>
      <Footer />
    </>
  )
}
