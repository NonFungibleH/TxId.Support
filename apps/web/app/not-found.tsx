import Link from "next/link"
import { Navbar } from "@/components/layout/Navbar"
import { Footer } from "@/components/layout/Footer"
import { Button } from "@/components/ui/Button"
import { FadeIn } from "@/components/ui/FadeIn"
import { SearchCheck, Boxes, Braces, BookOpen, Tag, Mail, ArrowRight } from "lucide-react"

const DESTINATIONS = [
  {
    icon: SearchCheck,
    title: "Try it live",
    description: "Paste any transaction hash and watch TxID diagnose it, free.",
    href: "/check",
  },
  {
    icon: Boxes,
    title: "Supported chains",
    description: "Every EVM chain we diagnose today, plus what's on the way.",
    href: "/chains",
  },
  {
    icon: Braces,
    title: "API & MCP",
    description: "The same diagnostic engine, headless, for your own tooling.",
    href: "/api",
  },
  {
    icon: BookOpen,
    title: "Documentation",
    description: "Install the widget and configure your project.",
    href: "/docs",
  },
  {
    icon: Tag,
    title: "Pricing",
    description: "Plans, limits, and what the free tier includes.",
    href: "/pricing",
  },
  {
    icon: Mail,
    title: "Talk to us",
    description: "Questions, early access, or a chain you want supported.",
    href: "/contact",
  },
]

export default function NotFound() {
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="max-w-4xl mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="font-mono text-sm text-accent mb-4">{"404"}</p>
              <h1 className="font-display text-5xl font-bold text-white mb-4 tracking-tight">
                This page moved or never existed
              </h1>
              <p className="text-muted text-lg max-w-md mx-auto">
                No dead end here. Pick up where you meant to go:
              </p>
            </div>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {DESTINATIONS.map((d, i) => (
              <FadeIn key={d.href} delay={(i % 3) * 0.05}>
                <Link
                  href={d.href}
                  className="group block h-full bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5 transition-colors hover:border-[var(--border-accent)]"
                >
                  <div className="flex items-center gap-3 mb-2.5">
                    <div className="w-9 h-9 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
                      <d.icon className="w-[1.125rem] h-[1.125rem] text-accent" />
                    </div>
                    <h2 className="font-display font-semibold text-white">{d.title}</h2>
                  </div>
                  <p className="text-sm text-muted leading-relaxed mb-3">{d.description}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                    Go <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              </FadeIn>
            ))}
          </div>

          <FadeIn delay={0.15}>
            <div className="text-center mt-12">
              <Button href="/" variant="outline">Back to home</Button>
            </div>
          </FadeIn>
        </div>
      </main>
      <Footer />
    </>
  )
}
