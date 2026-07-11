import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { ChainLogo } from "@/components/chains/ChainLogo";
import { APP_URL } from "@/lib/config";
import { CHAINS, getChain, accentVars, readableText, hexToRgba } from "@/lib/chains";
import { ArrowRight, Check, SearchCheck, MessagesSquare, Wallet } from "lucide-react";

export function generateStaticParams() {
  return CHAINS.map((c) => ({ slug: c.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const chain = getChain(params.slug);
  if (!chain) return {};
  const title = `AI Transaction Support for ${chain.name} | TxID Support`;
  const description = `${chain.intro} Diagnoses failed ${chain.name} transactions and gives users the fix, embedded in your product.`;
  return {
    title,
    description,
    alternates: { canonical: `/chains/${chain.slug}` },
    openGraph: { title, description, url: `/chains/${chain.slug}` },
  };
}

const VALUE_PROPS = [
  {
    icon: SearchCheck,
    title: "Reads the real transaction",
    description: "Not a canned FAQ — it looks up the user's actual on-chain transaction and decodes what happened.",
  },
  {
    icon: MessagesSquare,
    title: "Answers in plain English",
    description: "Turns raw revert data and error codes into a clear explanation and the exact next step.",
  },
  {
    icon: Wallet,
    title: "Knows the wallet & network",
    description: "Checks balance, gas, approvals and whether the user is even on the right network before replying.",
  },
];

export default function ChainPage({ params }: { params: { slug: string } }) {
  const chain = getChain(params.slug);
  if (!chain) notFound();

  const isLive = chain.status === "live";
  const ctaText = readableText(chain.color);
  const primaryHref = isLive ? `${APP_URL}/sign-up` : "/contact";
  const primaryLabel = isLive ? `Add TxID to ${chain.name}` : "Get early access";
  const secondaryHref = isLive ? "/demo" : "/platform";
  const secondaryLabel = isLive ? "See it live" : "See how it works";

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: chain.failures.map((f) => ({
      "@type": "Question",
      name: `${f.title} on ${chain.name}`,
      acceptedAnswer: { "@type": "Answer", text: f.detail },
    })),
  };
  const appLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `TxID Support for ${chain.name}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: `AI-powered transaction support and diagnosis for ${chain.name} protocols.`,
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
                <ChainLogo src={chain.logo} name={chain.name} color={chain.color} size={44} />
                <span className="text-muted text-xl font-light">×</span>
                <span className="font-display text-xl font-bold text-white">TxID</span>
              </div>

              <div className="flex items-center justify-center gap-3 mb-4">
                <p className="font-mono text-sm" style={{ color: chain.color }}>{chain.name}</p>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-mono text-[11px]"
                  style={{ border: `1px solid ${hexToRgba(chain.color, 0.4)}`, background: hexToRgba(chain.color, 0.1), color: chain.color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: chain.color }} />
                  {isLive ? "Live" : "Coming soon"}
                </span>
              </div>

              <h1 className="font-display text-5xl font-bold text-white mb-4 leading-[1.1] tracking-tight">
                AI support for
                <br />
                <span style={{ color: chain.color }}>{chain.name}</span> protocols.
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

        {/* What it diagnoses */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm mb-3" style={{ color: chain.color }}>What it diagnoses</p>
                <h2 className="font-display text-4xl font-bold text-white">
                  The {chain.name} failures your users hit
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

        {/* Why TxID */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <div className="text-center mb-12">
                <p className="font-mono text-sm mb-3" style={{ color: chain.color }}>Why TxID</p>
                <h2 className="font-display text-4xl font-bold text-white">Support that actually reads the chain</h2>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-3 gap-4">
              {VALUE_PROPS.map((v, i) => (
                <FadeIn key={v.title} delay={i * 0.06}>
                  <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6 h-full">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ background: hexToRgba(chain.color, 0.12) }}>
                      <v.icon className="w-5 h-5" style={{ color: chain.color }} />
                    </div>
                    <h3 className="font-display font-semibold text-white mb-2">{v.title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{v.description}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white mb-4">
                {isLive ? `Give your ${chain.name} users better answers` : `Building on ${chain.name}?`}
              </h2>
              <p className="text-muted mb-8 max-w-lg mx-auto">
                {isLive
                  ? `Install TxID in minutes and turn failed transactions into resolved ones — right inside your product.`
                  : `We're bringing TxID to ${chain.name} and onboarding design partners first. Tell us what you're building.`}
              </p>
              <a
                href={primaryHref}
                className="inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-medium transition-all duration-200"
                style={{ background: chain.color, color: ctaText, boxShadow: `0 10px 30px -10px ${hexToRgba(chain.color, 0.5)}` }}
              >
                {primaryLabel}
                <ArrowRight className="w-4 h-4" />
              </a>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
