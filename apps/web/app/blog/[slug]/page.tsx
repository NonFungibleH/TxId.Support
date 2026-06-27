import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { getPost, POSTS, type PostSection } from "@/lib/posts"
import Link from "next/link"
import { ArrowLeft, Clock, Tag } from "lucide-react"

export async function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const post = getPost(params.slug)
  if (!post) return {}
  return {
    title: `${post.title} — TxID Support`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.publishedAt,
    },
  }
}

function Section({ section }: { section: PostSection }) {
  switch (section.type) {
    case "h2":
      return (
        <h2 className="font-display text-2xl font-bold text-white mt-12 mb-4">
          {section.text}
        </h2>
      )
    case "h3":
      return (
        <h3 className="font-display text-lg font-semibold text-white mt-8 mb-3">
          {section.text}
        </h3>
      )
    case "p":
      return (
        <p className="text-[var(--text-muted)] leading-relaxed mb-5 text-base">
          {section.text}
        </p>
      )
    case "ul":
      return (
        <ul className="space-y-2 mb-6 ml-1">
          {(section.items ?? []).map((item, i) => (
            <li key={i} className="flex items-start gap-3 text-[var(--text-muted)] text-base leading-relaxed">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      )
    case "callout":
      return (
        <div className="my-8 rounded-xl border border-accent/30 bg-accent/5 p-5">
          {section.label && (
            <p className="text-xs font-mono font-semibold text-accent uppercase tracking-wider mb-2">
              {section.label}
            </p>
          )}
          <p className="text-white text-sm leading-relaxed">{section.text}</p>
        </div>
      )
    case "quote":
      return (
        <blockquote className="my-8 border-l-2 border-accent pl-5 italic text-[var(--text-muted)] text-base leading-relaxed">
          {section.text}
        </blockquote>
      )
    default:
      return null
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) notFound()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    author: { "@type": "Organization", name: "TxID Support" },
    publisher: { "@type": "Organization", name: "TxID Support" },
  }

  const formatted = new Date(post.publishedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />
      <main className="min-h-screen pt-28 pb-24">
        <div className="max-w-2xl mx-auto px-6">
          {/* Back */}
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors mb-10"
          >
            <ArrowLeft className="size-3.5" />
            All posts
          </Link>

          {/* Header */}
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 text-[10px] font-mono font-semibold text-accent uppercase tracking-wider"
                >
                  <Tag className="size-2.5" />
                  {tag}
                </span>
              ))}
            </div>
            <h1 className="font-display text-4xl font-bold text-white leading-tight mb-4">
              {post.title}
            </h1>
            <p className="text-muted text-base leading-relaxed mb-5">
              {post.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted/60">
              <span>{formatted}</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {post.readingMinutes} min read
              </span>
            </div>
          </header>

          <hr className="border-[var(--border)] mb-10" />

          {/* Body */}
          <article>
            {post.content.map((section, i) => (
              <Section key={i} section={section} />
            ))}
          </article>

          <hr className="border-[var(--border)] mt-12 mb-10" />

          {/* CTA */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 text-center">
            <p className="font-display font-semibold text-white mb-2">
              Ready to move support in-app?
            </p>
            <p className="text-sm text-muted mb-5">
              TxID Support gives your protocol an AI support widget that already knows what your users&apos; wallets did — embedded in your app, not Discord.
            </p>
            <a
              href="https://app.txid.support/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 transition-opacity"
            >
              Start free — 200 conversations/month
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
