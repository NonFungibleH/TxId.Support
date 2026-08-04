import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck, ScanSearch, Archive, ArrowRight, KeyRound, Eye,
  BadgeCheck, PenLine, Database, Milestone, Check,
} from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import { TrustMockup } from "@/components/sections/TrustMockup";

export const metadata: Metadata = {
  title: "Trust | TxID",
  description:
    "TxID is designed to operate safely alongside your protocol. It cannot move funds, it explains where its answers come from, and every interaction creates a reviewable record.",
  alternates: { canonical: "/security" },
};

// The three layers every answer passes through. Numbered and stacked so the
// page reads as a posture rather than a list of reassurances.
const LAYERS = [
  {
    n: "01",
    icon: KeyRound,
    title: "Read-only access",
    tagline: "No keys. No signing. No custody.",
    intro: "TxID only reads public blockchain data.",
    listLabel: "It never requires:",
    items: ["Private keys", "Seed phrases", "Signing permissions", "Contract permissions"],
    outro: "No assets are held. No transactions are executed.",
  },
  {
    n: "02",
    icon: Eye,
    title: "Verified answers",
    tagline: "Evidence behind every claim.",
    intro: "When TxID provides an answer, it can show the underlying source:",
    items: ["Live on-chain reads", "Transaction data", "Contract state", "Protocol documentation"],
    outro: "Users and teams can verify what happened instead of trusting a black box.",
  },
  {
    n: "03",
    icon: Archive,
    title: "Recorded by default",
    tagline: "Every interaction becomes a case record.",
    intro: "TxID stores the conversation, investigation, evidence, and outcome.",
    listLabel: "Teams can review:",
    items: [
      "What was asked",
      "What data was checked",
      "What answer was provided",
      "How the case was resolved",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28">
        {/* Hero */}
        <section className="pb-16">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <FadeIn>
                <p className="font-mono text-sm text-accent mb-3">Trust</p>
                <h1 className="font-display text-5xl font-bold text-white leading-[1.1] tracking-tight mb-5">
                  Read-only. Verifiable.
                  <br />
                  <span className="text-accent">Recorded.</span>
                </h1>
                <p className="text-lg text-muted leading-relaxed mb-3">
                  TxID is designed to operate safely alongside your protocol.
                </p>
                <p className="text-lg text-muted leading-relaxed">
                  It cannot move funds, it explains where its answers come from, and every
                  interaction creates a reviewable record.
                </p>
              </FadeIn>
              <FadeIn delay={0.1}>
                <TrustMockup />
              </FadeIn>
            </div>
          </div>
        </section>

        {/* The three layers */}
        <section className="py-20 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6">
            <FadeIn>
              <h2 className="font-display text-4xl font-bold text-white text-center mb-14">
                Every answer has three layers
              </h2>
            </FadeIn>
            <div className="grid md:grid-cols-3 gap-5">
              {LAYERS.map((l, i) => (
                <FadeIn key={l.title} delay={i * 0.08}>
                  <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-7 transition-colors hover:border-[var(--border-accent)]">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute right-5 top-4 font-mono text-5xl font-bold text-white/[0.04] transition-colors group-hover:text-white/[0.07] select-none"
                    >
                      {l.n}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                      <l.icon className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-white mb-1">{l.title}</h3>
                    <p className="text-sm text-accent mb-4">{l.tagline}</p>
                    <p className="text-sm text-muted leading-relaxed">{l.intro}</p>
                    {l.listLabel && (
                      <p className="text-sm text-muted leading-relaxed mt-3">{l.listLabel}</p>
                    )}
                    <ul className="mt-3 space-y-2">
                      {l.items.map((it) => (
                        <li key={it} className="flex items-start gap-2.5 text-sm text-muted">
                          <span className="mt-[0.45rem] w-1 h-1 rounded-full bg-accent shrink-0" />
                          <span>{it}</span>
                        </li>
                      ))}
                    </ul>
                    {l.outro && (
                      <p className="mt-4 text-sm text-[#c8c8d8] leading-relaxed border-l-2 border-accent/50 pl-4">
                        {l.outro}
                      </p>
                    )}
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* The detail a reviewer actually asks for */}
        <section className="py-20 border-t border-[var(--border)]">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-2 gap-5">
            <FadeIn>
              <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                  <ShieldCheck className="w-5 h-5 text-accent" />
                </div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-accent mb-2">
                  Read-only by design
                </p>
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  Built with clear boundaries
                </h2>
                <p className="text-sm text-muted mb-3">TxID:</p>
                <ul className="space-y-2.5">
                  {[
                    "Reads the same public data available through blockchain explorers",
                    "Requires no contract deployment or permissions",
                    "Cannot access funds or sign transactions",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-muted">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm text-[#c8c8d8] leading-relaxed border-l-2 border-accent/50 pl-4">
                  The safest integration is the one that never has access.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.06}>
              <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                  <BadgeCheck className="w-5 h-5 text-accent" />
                </div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-accent mb-2">
                  Verification tools
                </p>
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  Ask it to prove the answer
                </h2>
                <p className="text-sm text-muted mb-3">
                  TxID can support verification workflows including:
                </p>
                <ul className="space-y-2.5">
                  {[
                    "Live on-chain evidence behind responses",
                    "Address screening where supported",
                    "Contract verification",
                    "Protocol audit references",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-muted">
                      <ScanSearch className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </FadeIn>

            <FadeIn delay={0.12}>
              <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                  <PenLine className="w-5 h-5 text-accent" />
                </div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-accent mb-2">
                  Actions (optional)
                </p>
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  User-authorised actions, when enabled
                </h2>
                <p className="text-sm text-muted leading-relaxed mb-2.5">
                  Actions are disabled by default.
                </p>
                <p className="text-sm text-muted leading-relaxed mb-4">
                  When a protocol enables them, TxID prepares transactions that users review and
                  sign through their own wallet.
                </p>
                <p className="text-sm text-muted mb-3">Users remain in control:</p>
                <ul className="space-y-2.5">
                  {[
                    "Explicit user request required",
                    "User reviews exact transaction details",
                    "User signs in their own wallet",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2.5 text-sm text-muted">
                      <Check className="w-4 h-4 shrink-0 mt-0.5 text-accent" />
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm text-[#c8c8d8] leading-relaxed border-l-2 border-accent/50 pl-4">
                  Read-only mode remains the default.
                </p>
              </div>
            </FadeIn>

            <FadeIn delay={0.18}>
              <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                  <Database className="w-5 h-5 text-accent" />
                </div>
                <p className="font-mono text-[11px] uppercase tracking-widest text-accent mb-2">
                  {`Data & privacy`}
                </p>
                <h2 className="font-display text-xl font-bold text-white mb-4">
                  What TxID stores
                </h2>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <p className="text-sm font-semibold text-white mb-2.5">TxID stores:</p>
                    <ul className="space-y-2">
                      {[
                        "Conversations",
                        "Wallet addresses included in conversations",
                        "Project configuration",
                        "Usage metrics",
                      ].map((t) => (
                        <li key={t} className="flex items-start gap-2.5 text-sm text-muted">
                          <span className="mt-[0.45rem] w-1 h-1 rounded-full bg-accent shrink-0" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white mb-2.5">TxID never stores:</p>
                    <ul className="space-y-2">
                      {["Private keys", "Seed phrases", "Signing permissions"].map((t) => (
                        <li key={t} className="flex items-start gap-2.5 text-sm text-muted">
                          <span className="mt-[0.45rem] w-1 h-1 rounded-full bg-[#f87171] shrink-0" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-5 text-sm text-[#c8c8d8] leading-relaxed border-l-2 border-accent/50 pl-4">
                  There is no mechanism for the assistant to request them.
                </p>
                {/* Neither a configurable period nor an automatic purge exists yet.
                    Saying so beats quoting a figure nothing enforces, which is the
                    first thing a security reviewer checks against the system. */}
                <p className="mt-4 text-sm text-muted leading-relaxed">
                  Conversation data is kept for as long as the project is active, and is deleted
                  with the project. There is no automatic deletion schedule today, and deletion on
                  request is recorded rather than silent. Set out in our{" "}
                  <Link href="/privacy" className="text-accent hover:underline">privacy policy</Link>.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Roadmap honesty */}
        <section className="py-20 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6">
            <FadeIn>
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-8">
                <div className="flex items-center gap-3 mb-4">
                  <Milestone className="w-5 h-5 text-accent" />
                  <h2 className="font-display text-xl font-bold text-white">
                    What we have not built yet
                  </h2>
                </div>
                <p className="text-sm text-muted leading-relaxed mb-2.5">
                  A SOC 2 audit and configurable data retention are on the roadmap. Neither is
                  in place today.
                </p>
                <p className="text-sm text-[#c8c8d8] leading-relaxed">
                  Nothing else on this page implies otherwise. If a control is not listed above
                  as available today, assume we do not have it and ask us.
                </p>
              </div>
            </FadeIn>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 border-t border-[var(--border)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <FadeIn>
              <h2 className="font-display text-2xl font-bold text-white mb-3">
                Send this page to your reviewer
              </h2>
              <p className="text-muted max-w-lg mx-auto mb-6">
                For a data processing agreement or anything not covered here, we&apos;re one email away.
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <Button href="mailto:team@txid.support?subject=Security review" variant="primary" size="lg">
                  Talk to us
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/check" variant="outline" size="lg">
                  Try it live
                </Button>
              </div>
              <p className="text-xs text-muted/60 mt-5">
                See also our{" "}
                <Link href="/privacy" className="text-muted hover:text-white underline underline-offset-2">privacy policy</Link>{" "}
                and{" "}
                <Link href="/terms" className="text-muted hover:text-white underline underline-offset-2">terms</Link>.
              </p>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
