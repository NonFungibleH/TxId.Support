import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { FadeIn } from "@/components/ui/FadeIn"
import { POSTS } from "@/lib/posts"
import { BlogFilterControls } from "@/components/blog/BlogFilterControls"
import { PostHeroImage } from "@/components/blog/PostHeroImage"
import { ArrowRight, Clock } from "lucide-react"

export const metadata: Metadata = {
  title: "Blog | TxID",
  description: "Guides, deep-dives, and insights on Web3 customer support, DeFi security, and protocol operations.",
  alternates: { canonical: "/blog" },
}

// Fallback background behind the hero SVG (shown only if a variant has no image).
const heroGradients: Record<string, string> = {
  "discord-scam": "linear-gradient(135deg, #ef4444, #4b47e9)",
  "ticket-reduction": "linear-gradient(135deg, #10b981, #4b47e9)",
  "docs-qa": "linear-gradient(135deg, #4b47e9, #2a78b0)",
  "wallet-vs-generic": "linear-gradient(135deg, #10b981, #06b6d4)",
  "on-chain-data": "linear-gradient(135deg, #4b47e9, #06b6d4)",
  "telegram-community-support": "linear-gradient(135deg, #0088cc, #4b47e9)",
  "evaluate": "linear-gradient(135deg, #4b47e9, #10b981)",
  "agentic": "linear-gradient(135deg, #2a78b0, #4b47e9)",
  "gas": "linear-gradient(135deg, #4b47e9, #ef4444)",
  "revert": "linear-gradient(135deg, #ef4444, #10b981)",
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
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">{"Blog"}</p>
            <h1 className="font-display text-4xl font-bold text-white mb-4">
              Web3 support, explained
            </h1>
            <p className="text-muted text-base max-w-2xl">
              Guides and deep-dives on DeFi protocol support, on-chain diagnostics, and keeping your users safe.
            </p>
          </FadeIn>

          <div className="mt-10 lg:grid lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-10">
            {/* Filters: sidebar on desktop, stacked above the list on mobile */}
            <aside className="mb-10 lg:mb-0">
              <div className="lg:sticky lg:top-24">
                <Suspense fallback={null}>
                  <BlogFilterControls
                    allTags={allTags}
                    activeTag={activeTag}
                    activeSort={activeSort}
                  />
                </Suspense>
              </div>
            </aside>

            <div>
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
                    {/* Real hero image (the same graphic shown on the article) */}
                    <div
                      aria-hidden="true"
                      className="relative w-full overflow-hidden"
                      style={{
                        background: heroGradients[post.heroVariant] ?? "linear-gradient(135deg, #4b47e9, #3734d2)",
                      }}
                    >
                      <PostHeroImage variant={post.heroVariant} className="[&>svg]:block [&>svg]:w-full" />
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" />
                      <div className="absolute bottom-3 left-4 flex flex-wrap gap-2">
                        {post.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold text-white/90 bg-black/40 backdrop-blur-sm uppercase tracking-wider"
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
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
