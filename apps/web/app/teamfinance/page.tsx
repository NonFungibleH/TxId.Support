import type { Metadata } from "next";
import Link from "next/link";
import { PricingPackages } from "@/components/teamfinance/PricingPackages";
import {
  Lock, ShieldCheck, SearchCheck, MessageSquareText, Code2,
  ArrowRight, FileText, Mail, Check,
} from "lucide-react";

/**
 * Co-branded TxID × Team Finance landing page.
 *
 * DELIBERATELY LIGHT-THEMED, unlike the rest of txid.support. This page lives
 * in Team Finance's visual world (white, royal blue, gradient CTA bands) because
 * that is where the traffic comes from: a Team Finance user clicking through
 * from their menu. It carries TxID's content, typography and mark, but wears the
 * partner's palette so it reads as a shared page, not a TxID page with a logo
 * bolted on. It uses a custom light header/footer instead of the site's dark
 * chrome for the same reason.
 *
 * Team Finance's mark is a text wordmark on purpose (no third-party logo is
 * fabricated); their official asset is in their Brand Kit — drop it in
 * /public/brand and swap the wordmark when it arrives. Team Finance is a product
 * of TrustSwap Inc.; copy about them is accurate to their live site (21+ chains,
 * audited, 40,000+ projects) with no invented figures.
 */

const ONBOARD = "mailto:team@txid.support?subject=TxID%20%C3%97%20Team%20Finance%20onboarding&body=Hi%20TxID%20team%2C%20we%20came%20from%20Team%20Finance%20and%20would%20like%20to%20add%20the%20support%20agent%20to%20our%20token.";

export const metadata: Metadata = {
  title: "TxID × Team Finance: Trustworthy support for your token holders",
  description:
    "Team Finance projects get TxID's AI support agent, co-branded: it answers your holders from your own contracts and docs, diagnoses failed transactions in plain English, and shows the evidence behind every answer.",
  alternates: { canonical: "/teamfinance" },
  openGraph: {
    title: "TxID × Team Finance",
    description:
      "You locked your liquidity to earn trust. Give your holders answers they can trust, too. A co-branded support agent for Team Finance projects.",
    type: "website",
    url: "https://txid.support/teamfinance",
    siteName: "TxID",
  },
};

export default function TeamFinancePage() {
  return (
    // z-10 + opaque white sits above the dark site's fixed background overlay.
    <div className="relative z-10 min-h-screen bg-white font-sans text-slate-600">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <CoBrand />
          <a
            href={ONBOARD}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
          >
            Get onboarded
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="px-6 pt-20 pb-16">
          <div className="max-w-3xl mx-auto text-center">
            <p className="font-mono text-xs uppercase tracking-widest text-blue-600 mb-5">
              TxID × Team Finance partnership
            </p>
            <h1 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
              You locked your liquidity to earn trust.
              <br className="hidden sm:block" />{" "}
              <span className="text-blue-600">Give your holders answers they can trust, too.</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
              Team Finance projects get TxID&apos;s support agent, co-branded. It answers your holders
              from your own contracts and docs, explains a failed transaction in plain English, and
              shows the evidence behind every answer.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href={ONBOARD}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-base font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
              >
                Contact us to get onboarded
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="https://txid.support/check"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-6 py-3.5 text-base font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900 transition-colors"
              >
                See it live
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500">Exclusive onboarding for Team Finance projects.</p>
          </div>
        </section>

        {/* Feature grid */}
        <section className="px-6 py-16 bg-slate-50 border-y border-slate-200">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                A support agent that knows your token
              </h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Not a generic chatbot. It reads your locks, your vesting schedule, your contracts and
                your docs, so it answers the questions your community actually asks.
              </p>
            </div>
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
                <div key={title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-blue-600" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-slate-900 mb-2">{title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust thread */}
        <section className="px-6 py-20">
          <div className="max-w-5xl mx-auto grid lg:grid-cols-2 gap-6 items-start">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                <Lock className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-4 leading-snug">
                Trust doesn&apos;t stop at launch
              </h2>
              <p className="text-slate-600 leading-relaxed mb-4">
                Locking your liquidity and vesting your team tokens on Team Finance is how you earn
                trust on day one. It tells your community you are not going anywhere.
              </p>
              <p className="text-slate-600 leading-relaxed">
                But the trust that keeps holders is the day-to-day kind: a straight answer when a
                transaction fails, when a claim is confusing, or when someone is not sure their funds
                are safe. Silence in a Telegram channel is where confidence leaks away. TxID is the
                layer that answers, around the clock, from your own contracts.
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-mono uppercase tracking-widest text-blue-600 mb-4">
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
                    <MessageSquareText className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                    <span className="text-sm text-slate-800">{q}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-sm text-slate-500 leading-relaxed border-l-2 border-blue-200 pl-4">
                Every one of these is answerable from your contracts and live chain state. TxID
                answers them so your team does not have to, one holder at a time.
              </p>
            </div>
          </div>
        </section>

        {/* Onboarding — blue gradient band, Team Finance's signature */}
        {/* Pricing packages — Team Finance page only */}
        <section id="pricing" className="px-6 py-20 bg-slate-50 border-y border-slate-200">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <p className="font-mono text-xs uppercase tracking-widest text-blue-600 mb-3">Pricing</p>
              <h2 className="font-display text-3xl font-bold text-slate-900 mb-3">
                Pick a package, live the same day
              </h2>
              <p className="text-slate-600 max-w-xl mx-auto">
                Set pricing for projects that come through Team Finance. Every plan is priced on
                resolutions, not per-seat like a help desk, so it scales with your holders and not
                your headcount.
              </p>
            </div>
            <PricingPackages />
          </div>
        </section>

        <section className="px-6 pb-4 pt-20">
          <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 p-10 sm:p-14 text-white">
            <h2 className="font-display text-3xl font-bold text-center mb-10">Onboarding, start to finish</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { n: "01", t: "Get in touch", d: "Contact us from this page. Tell us your token and where your holders are." },
                { n: "02", t: "We connect it", d: "We point it at your contracts and docs and set your branding. This is quick." },
                { n: "03", t: "You go live", d: "Add one line to your site. Your holders get answers, co-branded with Team Finance." },
              ].map((s) => (
                <div key={s.n}>
                  <div className="font-mono text-sm text-blue-200 mb-2">{s.n}</div>
                  <h3 className="font-display text-lg font-bold mb-1.5">{s.t}</h3>
                  <p className="text-sm text-blue-100/90 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* About both partners */}
        <section className="px-6 py-20">
          <div className="max-w-5xl mx-auto">
            <p className="text-center font-mono text-xs uppercase tracking-widest text-blue-600 mb-8">
              About the partners
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <TeamFinanceWordmark className="mb-4" />
                <p className="text-sm text-slate-600 leading-relaxed">
                  Team Finance provides audited token and liquidity locks, token launches, and vesting
                  contracts across 21+ blockchains. It is where projects lock their liquidity and vest
                  their team tokens to say no to rug-pulls and show their community the fundamentals are
                  secured, trusted by 40,000+ projects.
                </p>
                <a
                  href="https://www.team.finance/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
                >
                  team.finance
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/txid-icon-64.png" alt="TxID" className="h-7 w-7 rounded-md" />
                  <span className="font-display text-lg font-bold text-slate-900">TxID</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">
                  TxID is the support layer for on-chain finance. It gives a protocol&apos;s users an AI
                  support agent that reads its contracts, documentation and live chain state, answers
                  with the evidence behind every claim, and keeps a reviewable record of every
                  conversation.
                </p>
                <a
                  href="https://txid.support/"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline"
                >
                  txid.support
                  <ArrowRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA — blue gradient band */}
        <section className="px-6 pb-24">
          <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 p-12 sm:p-16 text-center text-white">
            <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">
              Add trustworthy support to your token
            </h2>
            <p className="text-blue-100 max-w-lg mx-auto mb-8">
              Onboarding is hands-on and quick. Tell us about your project and we&apos;ll set you up.
            </p>
            <a
              href={ONBOARD}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-base font-semibold text-blue-700 hover:bg-blue-50 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact us to get onboarded
            </a>
            <div className="mt-6 flex items-center justify-center gap-4 text-xs text-blue-200">
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Co-branded</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Live in minutes</span>
              <span className="flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Read-only, evidence-backed</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <CoBrand small />
          <div className="flex items-center gap-5 text-sm text-slate-500">
            <a href="https://txid.support/" className="hover:text-slate-900 transition-colors">txid.support</a>
            <a href="https://www.team.finance/" target="_blank" rel="noopener noreferrer" className="hover:text-slate-900 transition-colors">team.finance</a>
            <Link href="/privacy" className="hover:text-slate-900 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/** TxID mark × Team Finance wordmark, on light. */
function CoBrand({ small = false }: { small?: boolean }) {
  const icon = small ? "h-6 w-6" : "h-7 w-7";
  const text = small ? "text-base" : "text-lg";
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/txid-icon-64.png" alt="TxID" className={`${icon} rounded-md`} />
        <span className={`font-display font-bold text-slate-900 ${text}`}>TxID</span>
      </div>
      <span className="text-slate-300 text-lg font-light select-none">×</span>
      <TeamFinanceWordmark size={small ? "sm" : "md"} />
    </div>
  );
}

/**
 * Text wordmark for Team Finance. Not a fabricated logo — replace with their
 * Brand Kit SVG (from team.finance) when supplied.
 */
function TeamFinanceWordmark({ className = "", size = "md" }: { className?: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const text = size === "sm" ? "text-base" : "text-lg";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className={`grid place-items-center rounded-md bg-blue-600 ${box}`}>
        <Lock className="w-3.5 h-3.5 text-white" />
      </span>
      <span className={`font-display font-bold text-slate-900 ${text}`}>Team&nbsp;Finance</span>
    </div>
  );
}
