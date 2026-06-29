import type { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { DOCS, getDoc, getDocsByCategory, type DocSection } from "@/lib/docs"
import { ArrowLeft, ArrowRight } from "lucide-react"

export async function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const doc = getDoc(params.slug)
  if (!doc) return {}
  return {
    title: `${doc.title} — TxID Support Docs`,
    description: doc.description,
  }
}

// ── Section renderer ─────────────────────────────────────────────────────────

function Section({ section }: { section: DocSection }) {
  switch (section.type) {
    case "h2":
      return (
        <h2 className="font-display text-xl font-bold text-white mt-10 mb-3">
          {section.text}
        </h2>
      )
    case "h3":
      return (
        <h3 className="font-display text-base font-semibold text-white mt-7 mb-2">
          {section.text}
        </h3>
      )
    case "p":
      return (
        <p className="text-[var(--text-muted)] leading-relaxed mb-5 text-sm">
          {section.text}
        </p>
      )
    case "ul":
      return (
        <ul className="space-y-2 mb-6 ml-1">
          {section.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[var(--text-muted)] text-sm leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )
    case "ol":
      return (
        <ol className="space-y-2 mb-6 ml-1 list-none">
          {section.items.map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[var(--text-muted)] text-sm leading-relaxed">
              <span className="font-mono text-xs text-accent/70 tabular-nums mt-0.5 shrink-0 w-4">{i + 1}.</span>
              {item}
            </li>
          ))}
        </ol>
      )
    case "callout": {
      const styles = {
        info:    { border: "border-accent/30",       bg: "bg-accent/5",        label: "text-accent",        labelText: "Note" },
        tip:     { border: "border-emerald-500/30",  bg: "bg-emerald-500/5",   label: "text-emerald-400",   labelText: "Tip" },
        warning: { border: "border-amber-500/30",    bg: "bg-amber-500/5",     label: "text-amber-400",     labelText: "Warning" },
      }[section.variant]
      return (
        <div className={`my-6 rounded-xl border ${styles.border} ${styles.bg} p-5`}>
          {(section.title || true) && (
            <p className={`text-xs font-mono font-semibold uppercase tracking-wider mb-2 ${styles.label}`}>
              {section.title ?? styles.labelText}
            </p>
          )}
          <p className="text-white text-sm leading-relaxed">{section.text}</p>
        </div>
      )
    }
    case "code":
      return (
        <div className="my-6 rounded-xl border border-[var(--border)] bg-[var(--bg-elevated)] overflow-hidden">
          {section.lang && (
            <div className="px-4 py-2 border-b border-[var(--border)]">
              <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                {section.lang}
              </span>
            </div>
          )}
          <pre className="p-4 overflow-x-auto">
            <code className="font-mono text-xs text-[var(--text-muted)] leading-relaxed whitespace-pre">
              {section.text}
            </code>
          </pre>
        </div>
      )
    case "grid":
      return (
        <div className="grid sm:grid-cols-2 gap-3 my-6">
          {section.items.map((item, i) => (
            <div key={i} className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4">
              <p className="font-display font-semibold text-white text-sm mb-1">{item.title}</p>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      )
    case "steps":
      return (
        <div className="my-6 space-y-0">
          {section.items.map((item, i) => (
            <div key={i} className="flex gap-4">
              {/* Step line */}
              <div className="flex flex-col items-center shrink-0">
                <div className="flex size-7 items-center justify-center rounded-full bg-accent/15 text-accent font-mono text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                {i < section.items.length - 1 && (
                  <div className="w-px flex-1 bg-[var(--border)] mt-1 mb-0 min-h-[20px]" />
                )}
              </div>
              {/* Content */}
              <div className={`pb-6 ${i === section.items.length - 1 ? "" : ""}`}>
                <p className="font-display font-semibold text-white text-sm mt-0.5 mb-1">{item.title}</p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )
    default:
      return null
  }
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ currentSlug }: { currentSlug: string }) {
  const categories = getDocsByCategory()
  return (
    <nav className="space-y-6">
      {categories.map((cat) => (
        <div key={cat.key}>
          <p className="font-mono text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-widest mb-2 px-2">
            {cat.label}
          </p>
          <div className="space-y-0.5">
            {cat.docs.map((doc) => (
              <Link
                key={doc.slug}
                href={`/docs/${doc.slug}`}
                className={`block rounded-lg px-2 py-1.5 text-sm transition-colors ${
                  doc.slug === currentSlug
                    ? "bg-accent/10 text-accent font-medium"
                    : "text-[var(--text-muted)] hover:text-white hover:bg-white/5"
                }`}
              >
                {doc.title}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function DocPage({ params }: { params: { slug: string } }) {
  const doc = getDoc(params.slug)
  if (!doc) notFound()

  const allDocs = getDocsByCategory().flatMap((c) => c.docs)
  const currentIndex = allDocs.findIndex((d) => d.slug === doc.slug)
  const prevDoc = currentIndex > 0 ? allDocs[currentIndex - 1] : null
  const nextDoc = currentIndex < allDocs.length - 1 ? allDocs[currentIndex + 1] : null

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-20 pb-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-12 pt-8">
            {/* Sidebar — desktop only */}
            <aside className="hidden lg:block w-52 shrink-0">
              <div className="sticky top-24">
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition-colors mb-6"
                >
                  <ArrowLeft className="size-3" />
                  All docs
                </Link>
                <Sidebar currentSlug={doc.slug} />
              </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 min-w-0 max-w-2xl">
              {/* Mobile back link */}
              <Link
                href="/docs"
                className="lg:hidden inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-white transition-colors mb-8"
              >
                <ArrowLeft className="size-3" />
                All docs
              </Link>

              {/* Header */}
              <header className="mb-8">
                <p className="font-mono text-xs text-accent mb-2">
                  {getDocsByCategory().find(c => c.key === doc.category)?.label}
                </p>
                <h1 className="font-display text-3xl font-bold text-white leading-tight mb-3">
                  {doc.title}
                </h1>
                <p className="text-[var(--text-muted)] text-sm leading-relaxed">
                  {doc.description}
                </p>
              </header>

              <hr className="border-[var(--border)] mb-8" />

              {/* Content */}
              <article>
                {doc.content.map((section, i) => (
                  <Section key={i} section={section} />
                ))}
              </article>

              {/* Prev / Next nav */}
              {(prevDoc || nextDoc) && (
                <>
                  <hr className="border-[var(--border)] mt-12 mb-8" />
                  <div className="flex items-stretch justify-between gap-4">
                    {prevDoc ? (
                      <Link
                        href={`/docs/${prevDoc.slug}`}
                        className="group flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-accent)] transition-colors flex-1"
                      >
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                          <ArrowLeft className="size-3" /> Previous
                        </span>
                        <span className="font-display font-semibold text-white text-sm group-hover:text-accent transition-colors">
                          {prevDoc.title}
                        </span>
                      </Link>
                    ) : <div className="flex-1" />}

                    {nextDoc ? (
                      <Link
                        href={`/docs/${nextDoc.slug}`}
                        className="group flex flex-col gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-4 hover:border-[var(--border-accent)] transition-colors flex-1 text-right items-end"
                      >
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                          Next <ArrowRight className="size-3" />
                        </span>
                        <span className="font-display font-semibold text-white text-sm group-hover:text-accent transition-colors">
                          {nextDoc.title}
                        </span>
                      </Link>
                    ) : <div className="flex-1" />}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
