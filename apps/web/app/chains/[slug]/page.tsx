import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { ChainLogo } from "@/components/chains/ChainLogo";
import { ChainDemo } from "@/components/chains/ChainDemo";
import { APP_URL } from "@/lib/config";
import { VISIBLE_CHAINS, getChain, getChainDemo, accentVars, readableText, hexToRgba } from "@/lib/chains";
import {
  ArrowRight, Check, SearchCheck, MessagesSquare, Wallet, Sparkles,
  AlertTriangle, Ban, BookLock, ScrollText, Code2, Send, Terminal,
} from "lucide-react";

export function generateStaticParams() {
  return VISIBLE_CHAINS.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const chain = getChain(params.slug);
  if (!chain || chain.hidden) return {};
  const title = `AI Transaction Support for ${chain.name} | TxID`;
  const description = `${chain.intro} Diagnoses failed ${chain.name} transactions and gives users the fix, embedded in your product.`;
  return {
    title,
    description,
    alternates: { canonical: `/chains/${chain.slug}` },
    openGraph: { title, description, url: `/chains/${chain.slug}` },
  };
}

export default function ChainPage({ params }: { params: { slug: string } }) {
  const chain = getChain(params.slug);
  if (!chain || chain.hidden) notFound();

  const isLive = chain.status === "live";
  const name = chain.name;
  // Most chain names start with a vowel sound (Ethereum, Aptos, Optimism...),
  // so "a Ethereum" reads wrong. Pick the article from the first letter.
  const article = /^[aeiou]/i.test(name) ? "an" : "a";
  const Article = article === "an" ? "An" : "A";
  const ctaText = readableText(chain.color);
  const primaryHref = isLive ? `${APP_URL}/sign-up` : "/contact";
  const primaryLabel = isLive ? `Add TxID to ${name}` : "Get early access";
  const secondaryHref = isLive ? (chain.family === "evm" ? "/check" : "/demo") : "/api";
  const secondaryLabel = isLive ? "See it live" : "See how it works";

  const demo = getChainDemo(chain.slug);
  const isEvm = chain.family === "evm";
  const walletLabel = isEvm ? "0x1a2b…3c4d connected" : "Wallet connected";
  // /check is an EVM-only funnel (curated EVM protocols, 0x address input), so
  // non-EVM visitors go to the general interactive demo instead.
  const demoHref = isEvm ? "/check" : "/demo";
  const demoLabel = isEvm ? "Try it live on a real tx" : "See a live demo";

  // The mechanism, benefit-led and chain-flavoured. This is the "how TxID
  // works" spine a chain reader needs before anything else.
  const STEPS = [
    { icon: AlertTriangle, n: "01", title: "A user gets stuck", body: `${Article} ${name} transaction fails, or a balance looks wrong, right inside your app.` },
    { icon: SearchCheck, n: "02", title: "TxID investigates", body: `It reads the user's actual ${name} transaction and works out what really happened. Not a generic FAQ.` },
    { icon: MessagesSquare, n: "03", title: "They get the fix", body: `A clear answer and the exact next step, in your branding, without anyone leaving your product.` },
  ];

  // Why it feels native to THIS chain, benefit-led.
  const BUILT = [
    { icon: SearchCheck, title: `Reads ${name} directly`, body: `Looks up the user's real transaction and on-chain state, then explains it. Never a canned answer.` },
    { icon: Sparkles, title: `Speaks ${name}`, body: chain.builtFor ?? `Knows the failures your ${name} users actually hit, and gives the exact fix for each one.` },
    { icon: Wallet, title: "Knows the wallet", body: "Checks balance, gas and approvals, and whether the user is even on the right network, before it replies." },
  ];

  const RECORD = [
    { icon: Ban, title: "Read-only by design", body: "It cannot move funds, touch keys, or give financial advice." },
    { icon: BookLock, title: "Grounded answers", body: "Built on your docs and live on-chain data. If something cannot be verified, it says so." },
    { icon: ScrollText, title: "Every answer, a record", body: "The question, evidence and outcome are saved as a case your team can review." },
  ];

  const SURFACES = [
    { icon: Code2, title: "In your product", body: "One script tag, your branding. Live in minutes, no infrastructure changes." },
    { icon: Send, title: "On Telegram", body: "The same assistant answers your community in your channels." },
    { icon: Terminal, title: "Through the API", body: "Wire on-chain answers into your own flows and tools." },
  ];

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: chain.failures.map((f) => ({
      "@type": "Question",
      name: `${f.title} on ${name}`,
      acceptedAnswer: { "@type": "Answer", text: f.detail },
    })),
  };
  const appLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `TxID for ${name}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: `AI-powered transaction support and diagnosis for ${name} protocols.`,
  };

  return (
    <>
      <Navbar />
      {/* The whole page inherits the chain's accent by overriding the vars. */}
      <main className="pt-24" style={accentVars(chain.color) as React.CSSProperties}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[420px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(ellipse at center, ${hexToRgba(chain.color, 0.18)} 0%, transparent 70%)` }}
          />
          <div className="max-w-6xl mx-auto px-6 pt-10 pb-16 text-center relative">
            <FadeIn>
              {/* Dual-brand lockup */}
              <div className="flex items-center justify-center gap-3 mb-6">
                <ChainLogo src={chain.logo} name={name} color={chain.color} size={44} whiteBg={chain.logoWhiteBg} />
                <span className="text-muted text-xl font-light">×</span>
                <span className="font-display text-xl font-bold text-white">TxID</span>
              </div>

              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="font-mono text-sm" style={{ color: chain.color }}>{name}</p>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px]"
                  style={{ border: `1px solid ${hexToRgba(chain.color, 0.4)}`, background: hexToRgba(chain.color, 0.1), color: chain.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: chain.color }} />
                  {isLive ? "Live" : "Coming soon"}
                </span>
              </div>

              <h1 className="font-display text-5xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
                Expert support for every
                <br />
                <span style={{ color: chain.color }}>{name}</span> user.
              </h1>
              <p className="text-lg text-muted max-w-2xl mx-auto mb-8">{chain.tagline}</p>

              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={primaryHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium transition-all duration-200"
                  style={{ background: chain.color, color: ctaText, boxShadow: `0 10px 30px -10px ${hexToRgba(chain.color, 0.5)}` }}
                >
                  {primaryLabel}
                  <ArrowRight className="w-4 h-4" />
                </a>
                <Button href={secondaryHref} variant="outline" size="lg">
                  {secondaryLabel}
                </Button>
              </div>

              {/* Credibility strip */}
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 mt-8 text-sm text-muted">
                {["Reads the real transaction", "Answers in your product", "Every answer, a record"].map((t, i) => (
                  <span key={t} className="inline-flex items-center gap-3">
                    {i > 0 && <span className="w-1 h-1 rounded-full bg-white/20" />}
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" style={{ color: chain.color }} />
                      {t}
                    </span>
                  </span>
                ))}
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Intro */}
        <section className="pb-4">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <p className="text-muted text-lg leading-relaxed">{chain.intro}</p>
            </FadeIn>
          </div>
        </section>

        {/* How it works */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm mb-3" style={{ color: chain.color }}>How it works</p>
                <h2 className="font-display text-4xl font-bold text-white">Support that reads the chain, not a script</h2>
              </div>
            </FadeIn>
            <div className="grid md:grid-cols-3 gap-6">
              {STEPS.map((step, i) => (
                <FadeIn key={step.n} delay={i * 0.1}>
                  <div className="relative flex h-full flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-accent)] transition-colors group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: hexToRgba(chain.color, 0.12) }}>
                        <step.icon className="w-5 h-5" style={{ color: chain.color }} />
                      </div>
                      <span aria-hidden="true" className="font-mono text-3xl font-bold text-white/5 group-hover:text-white/10 transition-colors select-none">
                        {step.n}
                      </span>
                    </div>
                    <h3 className="font-display text-lg font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{step.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Live demo */}
        {demo && (
          <section className="py-16">
            <div className="max-w-6xl mx-auto px-6">
              <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
                <FadeIn className="flex-1 text-center lg:text-left">
                  <p className="font-mono text-sm mb-3" style={{ color: chain.color }}>See it in action</p>
                  <h2 className="font-display text-4xl font-bold text-white mb-4 leading-tight">
                    Watch it diagnose {article}<br className="hidden lg:block" /> {name} failure
                  </h2>
                  <p className="text-muted leading-relaxed max-w-md mx-auto lg:mx-0 mb-8">
                    This is a scripted example. On {name}, TxID reads the user&apos;s real transaction, finds
                    the actual cause, and hands back the fix, right inside your product.
                  </p>
                  <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                    <a
                      href={demoHref}
                      className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium transition-all duration-200"
                      style={{ background: chain.color, color: ctaText, boxShadow: `0 10px 30px -10px ${hexToRgba(chain.color, 0.5)}` }}
                    >
                      {demoLabel}
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </FadeIn>
                <FadeIn delay={0.1} direction="none" className="shrink-0">
                  <ChainDemo messages={demo} chainName={name} walletLabel={walletLabel} />
                </FadeIn>
              </div>
            </div>
          </section>
        )}

        {/* What it diagnoses */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm mb-3" style={{ color: chain.color }}>What it diagnoses</p>
                <h2 className="font-display text-4xl font-bold text-white">
                  The {name} failures your users hit
                </h2>
              </div>
            </FadeIn>
            <div className="grid md:grid-cols-2 gap-4 max-w-4xl mx-auto">
              {chain.failures.map((f, i) => (
                <FadeIn key={f.title} delay={(i % 2) * 0.08}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 h-full flex gap-4">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: hexToRgba(chain.color, 0.12) }}
                    >
                      <Check className="w-5 h-5" style={{ color: chain.color }} />
                    </div>
                    <div>
                      <h3 className="font-display font-semibold text-white mb-1.5">{f.title}</h3>
                      <p className="text-sm text-muted leading-relaxed">{f.detail}</p>
                    </div>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Built for this chain */}
        <section className="py-16 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm mb-3" style={{ color: chain.color }}>Built for {name}</p>
                <h2 className="font-display text-4xl font-bold text-white mb-4">Not a generic bot with {article} {name} logo</h2>
                <p className="text-muted max-w-2xl mx-auto">
                  TxID is built to read {name} and understand how it actually behaves, so your users get real answers
                  instead of a canned FAQ.
                </p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-3 gap-4">
              {BUILT.map((v, i) => (
                <FadeIn key={v.title} delay={i * 0.06}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: hexToRgba(chain.color, 0.12) }}>
                      <v.icon className="w-5 h-5" style={{ color: chain.color }} />
                    </div>
                    <h3 className="font-display font-semibold text-white mb-2">{v.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{v.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* Every answer is a record */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm mb-3" style={{ color: chain.color }}>Safe and accountable</p>
                <h2 className="font-display text-4xl font-bold text-white mb-4">Every answer becomes a record</h2>
                <p className="text-muted max-w-2xl mx-auto">
                  Read-only by design, grounded in verified data, and fully auditable. Support without adding risk.
                </p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-3 gap-4">
              {RECORD.map((r, i) => (
                <FadeIn key={r.title} delay={i * 0.06}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: hexToRgba(chain.color, 0.12) }}>
                      <r.icon className="w-5 h-5" style={{ color: chain.color }} />
                    </div>
                    <h3 className="font-display font-semibold text-white mb-2">{r.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{r.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
            <FadeIn>
              <div className="text-center mt-10">
                <Link href="/security" className="inline-flex items-center gap-1.5 text-sm hover:gap-2.5 transition-all" style={{ color: chain.color }}>
                  Read the full security &amp; trust overview
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Drop-in for every app on the chain */}
        <section className="py-16 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm mb-3" style={{ color: chain.color }}>Drop-in</p>
                <h2 className="font-display text-4xl font-bold text-white mb-4">Live on every {name} app in minutes</h2>
                <p className="text-muted max-w-2xl mx-auto">
                  One integration, wherever your users are. No support stack to rebuild.
                </p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-3 gap-4">
              {SURFACES.map((s, i) => (
                <FadeIn key={s.title} delay={i * 0.06}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: hexToRgba(chain.color, 0.12) }}>
                      <s.icon className="w-5 h-5" style={{ color: chain.color }} />
                    </div>
                    <h3 className="font-display font-semibold text-white mb-2">{s.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{s.body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                {isLive ? `Give your ${name} users better answers` : `Building on ${name}?`}
              </h2>
              <p className="text-muted mb-8 max-w-lg mx-auto">
                {isLive
                  ? `Add TxID in minutes and turn failed transactions into resolved ones, right inside your product.`
                  : `We're bringing TxID to ${name} and onboarding design partners first. Tell us what you're building.`}
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <a
                  href={primaryHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium transition-all duration-200"
                  style={{ background: chain.color, color: ctaText, boxShadow: `0 10px 30px -10px ${hexToRgba(chain.color, 0.5)}` }}
                >
                  {primaryLabel}
                  <ArrowRight className="w-4 h-4" />
                </a>
                <Button href="/contact" variant="outline" size="lg">
                  Talk to us
                </Button>
              </div>
              <p className="text-sm text-muted mt-6">
                Building on {name}, or growing its ecosystem? We would love to talk.
              </p>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
