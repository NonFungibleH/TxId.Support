import type { Metadata } from "next";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FadeIn } from "@/components/ui/FadeIn";
import { Button } from "@/components/ui/Button";
import {
  Lock, ShieldCheck, SearchCheck, MessageSquareText, Code2,
  ArrowRight, FileText, Mail,
} from "lucide-react";

// Referral attribution: onboarding requests from this page carry the partner in
// the subject, so the Team Finance channel is measurable from day one.
const ONBOARD = "mailto:team@txid.support?subject=TxID%20%C3%97%20Team%20Finance%20onboarding&body=Hi%20TxID%20team%2C%20we%20came%20from%20Team%20Finance%20and%20would%20like%20to%20add%20the%20support%20agent%20to%20our%20token.";

export const metadata: Metadata = {
  title: "TxID × Team Finance: Trustworthy support for your token holders",
  description:
    "Team Finance projects get TxID's AI support agent, co-branded: it answers your holders from your own contracts and docs, diagnoses failed transactions in plain English, and shows the evidence behind every answer.",
  alternates: { canonical: "/partners/team-finance" },
  openGraph: {
    title: "TxID × Team Finance",
    description:
      "You locked your liquidity to earn trust. Give your holders answers they can trust, too. A co-branded support agent for Team Finance projects.",
    type: "website",
    url: "https://txid.support/partners/team-finance",
    siteName: "TxID",
  },
};

/**
 * Co-branded partner landing page. TxID hosts it; Team Finance links to it from
 * their menu. The Team Finance name is used under a real partnership; their
 * mark is a text wordmark here on purpose (no third-party logo asset is
 * fabricated) — drop their supplied SVG into /public/brand and swap the
 * wordmark span for an <img> when it arrives.
 */
export default function TeamFinancePartnerPage() {
  return (
    <>
      <Navbar />
      <main className="pt-28 pb-24">
        {/* Hero */}
        <section className="px-6">
          <div className="max-w-3xl mx-auto text-center">
            <FadeIn>
              <CoBrandLockup className="justify-center mb-8" />
            </FadeIn>
            <FadeIn delay={0.05}>
              <p className="font-mono text-sm text-accent mb-4">Partnership</p>
              <h1 className="font-display text-4xl sm:text-5xl font-bold text-white leading-[1.12] tracking-tight mb-5">
                You locked your liquidity to earn trust.
                <br />
                <span className="text-accent">Give your holders answers they can trust, too.</span>
              </h1>
              <p className="text-lg text-muted leading-relaxed max-w-2xl mx-auto">
                Team Finance projects get TxID&apos;s support agent, co-branded. It answers your
                holders from your own contracts and docs, explains a failed transaction in plain
                English, and shows the evidence behind every answer.
              </p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button href={ONBOARD} variant="primary" size="lg">
                  Contact us to get onboarded
                  <ArrowRight className="w-4 h-4" />
                </Button>
                <Button href="/check" variant="outline" size="lg">
                  See it live
                </Button>
              </div>
              <p className="mt-3 text-xs text-muted">Exclusive onboarding for Team Finance projects.</p>
            </FadeIn>
          </div>
        </section>

        {/* What Team Finance projects get */}
        <section className="px-6 mt-24">
          <div className="max-w-5xl mx-auto">
            <FadeIn>
              <div className="text-center mb-12">
                <h2 className="font-display text-3xl font-bold text-white mb-3">
                  A support agent that knows your token
                </h2>
                <p className="text-muted max-w-2xl mx-auto">
                  Not a generic chatbot. It reads your locks, your vesting schedule, your contracts
                  and your docs, so it answers the questions your community actually asks.
                </p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  icon: SearchCheck,
                  title: "Explains failed transactions",
                  body: "A holder's swap or claim reverted? It reads the transaction and says why, in plain English, with the next step, instead of leaving them stuck on a block explorer.",
                },
                {
                  icon: FileText,
                  title: "Answers from your contracts and docs",
                  body: "Vesting schedules, claim windows, lock unlock dates, how your token works: it answers from what you actually published, not from guesswork.",
                },
                {
                  icon: ShieldCheck,
                  title: "Evidence behind every answer",
                  body: "It reads live chain state and shows where each answer came from, so a holder can verify it rather than take a bot's word for it. Every conversation is recorded.",
                },
                {
                  icon: Code2,
                  title: "One line to embed, your branding",
                  body: "A single snippet on your site, matched to your colours and logo. Your holders never leave your page, and the co-branded rollout takes minutes.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <FadeIn key={title}>
                  <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 transition-colors hover:border-[var(--border-accent)]">
                    <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center mb-4">
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <h3 className="font-display text-lg font-bold text-white mb-2">{title}</h3>
                    <p className="text-sm text-muted leading-relaxed">{body}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* The trust thread — why this fits a Team Finance project specifically */}
        <section className="px-6 mt-24">
          <div className="max-w-5xl mx-auto rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
            <div className="grid lg:grid-cols-2">
              <div className="p-8 sm:p-10">
                <div className="w-11 h-11 rounded-xl bg-accent-muted flex items-center justify-center mb-5">
                  <Lock className="w-5 h-5 text-accent" />
                </div>
                <h2 className="font-display text-2xl font-bold text-white mb-4 leading-snug">
                  Trust doesn&apos;t stop at launch
                </h2>
                <p className="text-muted leading-relaxed mb-4">
                  Locking your liquidity and vesting your team tokens on Team Finance is how you earn
                  trust on day one. It tells your community you are not going anywhere.
                </p>
                <p className="text-muted leading-relaxed">
                  But the trust that keeps holders is the day-to-day kind: a straight answer when a
                  transaction fails, when a claim is confusing, or when someone is not sure their
                  funds are safe. Silence in a Telegram channel is where confidence leaks away. TxID
                  is the layer that answers, around the clock, from your own contracts.
                </p>
              </div>
              <div className="border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-[var(--bg-elevated)]/40 p-8 sm:p-10">
                <p className="text-[11px] font-mono uppercase tracking-widest text-accent mb-4">
                  What your holders ask
                </p>
                <ul className="space-y-3.5">
                  {[
                    "Why did my swap fail?",
                    "When can I claim my vested tokens?",
                    "Is my transaction stuck, or did it go through?",
                    "Why was my claim rejected?",
                    "Is this the real contract?",
                  ].map((q) => (
                    <li key={q} className="flex items-start gap-3">
                      <MessageSquareText className="w-4 h-4 shrink-0 mt-0.5 text-accent/70" />
                      <span className="text-sm text-white/85">{q}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 text-sm text-muted leading-relaxed border-l-2 border-accent/40 pl-4">
                  Every one of these is answerable from your contracts and live chain state. TxID
                  answers them so your team does not have to, one holder at a time.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How onboarding works */}
        <section className="px-6 mt-24">
          <div className="max-w-4xl mx-auto">
            <FadeIn>
              <h2 className="font-display text-3xl font-bold text-white text-center mb-12">
                Onboarding, start to finish
              </h2>
            </FadeIn>
            <div className="grid sm:grid-cols-3 gap-4">
              {[
                { n: "01", t: "Get in touch", d: "Contact us from this page. Tell us your token and where your holders are." },
                { n: "02", t: "We connect it", d: "We point it at your contracts and docs and set your branding. This is quick." },
                { n: "03", t: "You go live", d: "Add one line to your site. Your holders get answers, co-branded with Team Finance." },
              ].map((s) => (
                <FadeIn key={s.n}>
                  <div className="relative h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-6 overflow-hidden">
                    <span aria-hidden className="pointer-events-none absolute right-4 top-2 font-mono text-5xl font-bold text-white/[0.04] select-none">
                      {s.n}
                    </span>
                    <h3 className="font-display text-base font-bold text-white mb-1.5">{s.t}</h3>
                    <p className="text-sm text-muted leading-relaxed">{s.d}</p>
                  </div>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* About both companies — shared details */}
        <section className="px-6 mt-24">
          <div className="max-w-5xl mx-auto">
            <FadeIn>
              <p className="text-center font-mono text-sm text-accent mb-8">About the partners</p>
            </FadeIn>
            <div className="grid md:grid-cols-2 gap-4">
              <FadeIn>
                <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-7">
                  <TeamFinanceWordmark className="mb-4" />
                  <p className="text-sm text-muted leading-relaxed">
                    Team Finance provides audited token and liquidity locks, token launches, and
                    vesting contracts across 21+ blockchains. It is where projects lock their
                    liquidity and vest their team tokens to say no to rug-pulls and show their
                    community the fundamentals are secured, trusted by 40,000+ projects.
                  </p>
                  <a
                    href="https://www.team.finance/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                  >
                    team.finance
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </FadeIn>
              <FadeIn delay={0.06}>
                <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--bg-surface)] p-7">
                  <div className="flex items-center gap-2.5 mb-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/brand/txid-icon-64.png" alt="TxID" className="h-7 w-7" />
                    <span className="font-display text-lg font-bold text-white">TxID</span>
                  </div>
                  <p className="text-sm text-muted leading-relaxed">
                    TxID is the support layer for on-chain finance. It gives a protocol&apos;s users an
                    AI support agent that reads its contracts, documentation and live chain state,
                    answers with the evidence behind every claim, and keeps a reviewable record of
                    every conversation.
                  </p>
                  <a
                    href="/"
                    className="mt-4 inline-flex items-center gap-1.5 text-sm text-accent hover:underline"
                  >
                    txid.support
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </FadeIn>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-6 mt-24">
          <div className="max-w-3xl mx-auto text-center rounded-3xl border border-[var(--border)] bg-[var(--bg-surface)] p-10 sm:p-12">
            <FadeIn>
              <CoBrandLockup className="justify-center mb-6" small />
              <h2 className="font-display text-3xl font-bold text-white mb-3">
                Add trustworthy support to your token
              </h2>
              <p className="text-muted max-w-lg mx-auto mb-7">
                Onboarding is hands-on and quick. Tell us about your project and we&apos;ll set you up.
              </p>
              <Button href={ONBOARD} variant="primary" size="lg">
                <Mail className="w-4 h-4" />
                Contact us to get onboarded
              </Button>
            </FadeIn>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

/** TxID mark × Team Finance wordmark. */
function CoBrandLockup({ className = "", small = false }: { className?: string; small?: boolean }) {
  const size = small ? "h-7 w-7" : "h-9 w-9";
  const text = small ? "text-lg" : "text-xl";
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/txid-icon-64.png" alt="TxID" className={size} />
        <span className={`font-display font-bold text-white ${text}`}>TxID</span>
      </div>
      <span className="text-muted/50 text-lg font-light select-none">×</span>
      <TeamFinanceWordmark size={small ? "sm" : "md"} />
    </div>
  );
}

/**
 * Text wordmark for Team Finance. Deliberately not a fabricated logo — when
 * Team Finance supplies their SVG, drop it in /public/brand and replace this.
 */
function TeamFinanceWordmark({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const text = size === "sm" ? "text-lg" : "text-xl";
  const box = size === "sm" ? "h-7 w-7" : "h-9 w-9";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`grid place-items-center rounded-lg bg-white/[0.06] border border-[var(--border)] ${box}`}>
        <Lock className="w-4 h-4 text-white/80" />
      </span>
      <span className={`font-display font-bold text-white ${text}`}>
        Team&nbsp;Finance
      </span>
    </div>
  );
}
