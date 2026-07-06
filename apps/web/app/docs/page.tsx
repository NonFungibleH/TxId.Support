import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { FadeIn } from "@/components/ui/FadeIn"
import { getDocsByCategory } from "@/lib/docs"
import { ArrowRight, BookOpen, Zap, Paintbrush, FileCode2, BookMarked, Link2, LayoutList, Eye, Code2, MessagesSquare, Ticket, BarChart3 } from "lucide-react"

export const metadata: Metadata = {
  title: "Documentation | TxID Support",
  description: "Guides and reference for every TxID Support feature: branding, smart contracts, knowledge base, content blocks, and more.",
  alternates: { canonical: "/docs" },
}

const ICONS: Record<string, React.ElementType> = {
  introduction:    BookOpen,
  "quick-start":   Zap,
  branding:        Paintbrush,
  "smart-contracts": FileCode2,
  "knowledge-base":  BookMarked,
  chains:          Link2,
  "content-blocks":  LayoutList,
  preview:         Eye,
  embed:           Code2,
  conversations:   MessagesSquare,
  tickets:         Ticket,
  analytics:       BarChart3,
}

const CATEGORY_ICONS: Record<string, string> = {
  "getting-started": "01",
  "configuration":   "02",
  "features":        "03",
  "data":            "04",
}

export default function DocsPage() {
  const categories = getDocsByCategory()

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-28 pb-24">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">{"Documentation"}</p>
            <h1 className="font-display text-4xl font-bold text-white mb-4">
              TxID Support docs
            </h1>
            <p className="text-[var(--text-muted)] text-base max-w-xl">
              Everything you need to configure, embed, and get the most out of your AI support widget.
            </p>
          </FadeIn>

          <div className="mt-14 space-y-12">
            {categories.map((cat, ci) => (
              <FadeIn key={cat.key} delay={ci * 0.08}>
                <div>
                  {/* Category header */}
                  <div className="flex items-center gap-3 mb-5">
                    <span className="font-mono text-xs text-accent/60 tabular-nums">
                      {CATEGORY_ICONS[cat.key]}
                    </span>
                    <h2 className="font-display text-sm font-semibold text-white uppercase tracking-wider">
                      {cat.label}
                    </h2>
                    <div className="flex-1 h-px bg-[var(--border)]" />
                  </div>

                  {/* Doc cards */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {cat.docs.map((doc) => {
                      const Icon = ICONS[doc.slug] ?? BookOpen
                      return (
                        <Link
                          key={doc.slug}
                          href={`/docs/${doc.slug}`}
                          className="group flex items-start gap-4 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 hover:border-[var(--border-accent)] transition-colors"
                        >
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent mt-0.5">
                            <Icon className="size-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-display font-semibold text-white text-sm group-hover:text-accent transition-colors">
                                {doc.title}
                              </p>
                              <ArrowRight className="size-3.5 text-[var(--text-muted)] shrink-0 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                            </div>
                            <p className="text-xs text-[var(--text-muted)] mt-1 leading-relaxed">
                              {doc.description}
                            </p>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* Bottom CTA */}
          <FadeIn delay={0.4}>
            <div className="mt-16 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
              <p className="font-display font-semibold text-white mb-2">
                Something missing?
              </p>
              <p className="text-sm text-[var(--text-muted)] mb-5">
                If you can&apos;t find what you need, reach out. We&apos;re happy to help.
              </p>
              <a
                href="mailto:team@txid.support"
                className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              >
                Contact support
              </a>
            </div>
          </FadeIn>
        </div>
      </main>
      <Footer />
    </>
  )
}
