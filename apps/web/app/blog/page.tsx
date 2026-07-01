import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { FadeIn } from "@/components/ui/FadeIn"
import { POSTS } from "@/lib/posts"
import { BlogFilterControls } from "@/components/blog/BlogFilterControls"
import { ArrowRight, Clock } from "lucide-react"

export const metadata: Metadata = {
  title: "Blog | TxID Support",
  description: "Guides, deep-dives, and insights on Web3 customer support, DeFi security, and protocol operations.",
}

const heroGradients: Record<string, string> = {
  "discord-scam": "linear-gradient(135deg, #ef4444, #6366f1)",
  "ticket-reduction": "linear-gradient(135deg, #10b981, #6366f1)",
  "docs-qa": "linear-gradient(135deg, #6366f1, #8b5cf6)",
  "wallet-vs-generic": "linear-gradient(135deg, #10b981, #06b6d4)",
  "on-chain-data": "linear-gradient(135deg, #6366f1, #06b6d4)",
  "telegram-community-support": "linear-gradient(135deg, #0088cc, #6366f1)",
}

export default function BlogPage({
  searchParams,
}: {
  searchParams: { tag?: string; sort?: string }
}) {
  const activeTag = searchParams.tag ?? "all"
  const activeSort = searchParams.sort ?? "newest"

  // Collect all unique tags from ALL posts
  const allTags = Array.from(new Set(POSTS.flatMap((p) => p.tags)))

  // Filter
  let filtered = activeTag && activeTag !== "all"
    ? POSTS.filter((p) => p.tags.includes(activeTag))
    : [...POSTS]

  // Sort
  if (activeSort === "oldest") {
    filtered = filtered.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
  } else if (activeSort === "quickest") {
    filtered = filtered.sort((a, b) => a.readingMinutes - b.readingMinutes)
  } else {
    filtered = filtered.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-28 pb-24">
        <div className="max-w-2xl mx-auto px-6">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">{"Blog"}</p>
            <h1 className="font-display text-4xl font-bold text-white mb-4">
              Web3 support, explained
            </h1>
            <p className="text-muted text-base">
              Guides and deep-dives on DeFi protocol support, on-chain diagnostics, and keeping your users safe.
            </p>
          </FadeIn>

          <div className="mt-10">
            <Suspense fallback={null}>
              <BlogFilterControls
                allTags={allTags}
                activeTag={activeTag}
                activeSort={activeSort}
              />
            </Suspense>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-12 text-center">
              <p className="font-mono text-sm text-muted">No posts found for this filter.</p>
              <Link href="/blog" className="mt-4 inline-block text-xs text-accent hover:underline">
                Clear filter
              </Link>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              {filtered.map((post, i) => (
                <FadeIn key={post.slug} delay={i * 0.06}>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="group block rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden hover:border-[var(--border-accent)] transition-colors"
                  >
                    {/* Gradient accent strip */}
                    <div
                      role="presentation"
                      aria-hidden="true"
                      className="relative w-full"
                      style={{
                        height: "80px",
                        background: heroGradients[post.heroVariant] ?? "linear-gradient(135deg, #6366f1, #4f46e5)",
                      }}
                    >
                      <div className="absolute bottom-3 left-4 flex flex-wrap gap-2">
                        {post.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold text-white/90 bg-black/30 backdrop-blur-sm uppercase tracking-wider"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h2 className="font-display font-semibold text-white text-lg leading-snug mb-2 group-hover:text-accent transition-colors">
                            {post.title}
                          </h2>
                          <p className="text-sm text-muted leading-relaxed">
                            {post.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-3 mt-4 text-xs text-muted/60">
                            <span className="font-mono text-accent/80">by {post.author}</span>
                            <span>
                              {new Date(post.publishedAt).toLocaleDateString("en-GB", {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="size-3" />
                              {post.readingMinutes} min read
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="size-4 text-muted shrink-0 mt-1 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  )
}
