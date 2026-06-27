import type { Metadata } from "next"
import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { FadeIn } from "@/components/ui/FadeIn"
import { POSTS } from "@/lib/posts"
import { ArrowRight, Clock } from "lucide-react"

export const metadata: Metadata = {
  title: "Blog — TxID Support",
  description: "Guides, deep-dives, and insights on Web3 customer support, DeFi security, and protocol operations.",
}

export default function BlogPage() {
  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-28 pb-24">
        <div className="max-w-2xl mx-auto px-6">
          <FadeIn>
            <p className="font-mono text-sm text-accent mb-3">{"// Blog"}</p>
            <h1 className="font-display text-4xl font-bold text-white mb-4">
              Web3 support, explained
            </h1>
            <p className="text-muted text-base">
              Guides and deep-dives on DeFi protocol support, on-chain diagnostics, and keeping your users safe.
            </p>
          </FadeIn>

          <div className="mt-12 space-y-4">
            {POSTS.map((post, i) => (
              <FadeIn key={post.slug} delay={i * 0.06}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group block rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 hover:border-[var(--border-accent)] transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        {post.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-[10px] font-mono font-semibold text-accent uppercase tracking-wider">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <h2 className="font-display font-semibold text-white text-lg leading-snug mb-2 group-hover:text-accent transition-colors">
                        {post.title}
                      </h2>
                      <p className="text-sm text-muted leading-relaxed">
                        {post.description}
                      </p>
                      <div className="flex items-center gap-3 mt-4 text-xs text-muted/60">
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
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
